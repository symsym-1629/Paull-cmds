const {EmbedBuilder, Client, GatewayIntentBits, Partials, CommandInteractionOptionResolver} = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions],
  'partials': [Partials.Channel] });
const Config = require('./config');
const sql = require("sqlite");
const embed = new EmbedBuilder();
const prefix = "?s";

sql.open("./database.sqlite");

client.on("ready", () => {
    console.log("Bot démarré :) " + client.guilds.cache.size + " serveurs !");
    createDatabase(sql);
    client.user
    .setPresence({ activities: [{ name: '?s 2 Vous allez bien ?' }], status: 'online' })
});

/**
 * Will be executed each time the bot see a message
 */
 client.on("messageCreate", async (message) => {

  if (message.mentions.users.last() && message.mentions.users.last().id == client.user.id) {
    let embed = new EmbedBuilder();
    embed.setTitle(":information_source: Je suis maintenant en slash command !");
    embed.setDescription("Si vous avez besoin de plus d'assistance, rejoignez le discord d'aide : https://discord.gg/GWTFMQv");
    message.channel.send({embeds: [embed]});
  }
});

client.on("interactionCreate", async (interaction) => {
  if (argsIsNotValid(interaction)) {
    return sendArgsErrorMessage(interaction);
  }

  let msg = await repostTheQuestion(interaction);
  await addReactions(interaction, msg);
  saveNewPoll(interaction, msg);
});

/**
 * Will be executed each time the bot see a new reaction
 */
client.on("messageReactionAdd", async (reaction) => {
  if (reactionIsOnApoll(reaction)) {
    let pollexist = await sql.get(`SELECT count(*) as number from poll where messageId = ${reaction.message.id}`);
    if (pollexist.number != 1) {
      embed.setTitle(":x: Erreur !");
      embed.setColor("#D92D43");
      embed.setDescription("Ce sondage est terminé !");
      return reaction.users.cache.last().send(embed);
    }
    deleteLastReaction(reaction);
    if (reaction.me) { // test if the reaction is part of the poll
      //if so, add it to the database
      if (reaction.emoji.name == "📜") {
        let pollauthorid = await sql.get(`select authorId as id from poll where messageId = ${reaction.message.id}`);
        if (reaction.users.cache.last().id == pollauthorid.id) {

          sendingResults(reaction);

        } else {
          errorStopingPoll(reaction);
        }
        return;
      }
      let numberOfVoteByThisUserOnThisPoll = await getNumberOfVote(reaction);
      if (numberOfVoteByThisUserOnThisPoll == 0) {
        saveVote(reaction);
        confirmVote(reaction);
      } else {
        updateVote(reaction);
        confirmChangeVote(reaction);
      }
      await updatePollMessage(reaction);
    }
  }
});

/**
 * used ot get the amount of vote on a poll and edit the message
 * @param {*} reaction 
 */
 async function updatePollMessage(reaction) {
  let embedToEdit = reaction.message.embeds[0].from;
  let title = reaction.message.embeds[0].title
  let number = await sql.get(`select count(*) as number from vote where pollId = ${reaction.message.id}`).catch(console.error);
  number = number.number;
  embedToEdit = new EmbedBuilder;
  embedToEdit.setDescription("Utilisez les réactions ci-dessous pour répondre à la question. Utilisez la réaction 📜 pour visionner les résultats si vous êtes l'initiateur du sondage\n\n" + number + " vote(s) reçu(s).");
  embedToEdit.setTitle(`${title}`);
  embedToEdit.setColor("#006D68")
  reaction.message.edit({embeds: [embedToEdit]});
}

/**
 * Send a dm to notify an error
 * 
 * @param {*} reaction 
 */
async function sendingResults(reaction) {
  let results = await getPoll(reaction);
  let resultsEmbed = generateEmbedBegining(reaction);
  if (results.numberOfOptions != 2) {
    await displayResultForMultichoicePoll(results, reaction, resultsEmbed);
  } else {
    await displayResultForDualChoicePoll(reaction, resultsEmbed);
  }
  reaction.message.channel.send({embeds: [resultsEmbed]});
  await sql.get(`delete from poll where messageId = ${reaction.message.id}`);
  await sql.get(`delete from vote where pollId = ${reaction.message.id}`);
}

/**
 * get the poll infos
 * @param {*} reaction 
 */
async function getPoll(reaction) {
  return await sql.get(`select * from poll where messageId = ${reaction.message.id}`);
}

/**
 * display the results for dual choice polls
 * @param {*} reaction 
 * @param {*} resultsEmbed 
 */
async function displayResultForDualChoicePoll(reaction, resultsEmbed) {
  let votes = await sql.get(`select count(*) as r from vote where pollId = ${reaction.message.id} and vote = "✅"`);
  resultsEmbed.addFields({name: "Option : :white_check_mark:", value: "Nombre de votes : " + votes.r});
  votes = await sql.get(`select count(*) as r from vote where pollId = ${reaction.message.id} and vote = "❌"`);
  resultsEmbed.addFields({name: "Option : :x:", value:  "Nombre de votes : " + votes.r});
}

/**
 * display the results for multi choice polls
 * @param {*} results 
 * @param {*} reaction 
 * @param {*} resultsEmbed 
 */
async function displayResultForMultichoicePoll(results, reaction, resultsEmbed) {
  let = array = {
    "1": "1️⃣",
    "2": "2️⃣",
    "3": "3️⃣",
    "4": "4️⃣",
    "5": "5️⃣",
    "6": "6️⃣",
    "7": "7️⃣",
    "8": "8️⃣",
    "9": "9️⃣",
    "10": "🔟"
  };
  for (let i = 1; i <= results.numberOfOptions; i++) {
    let votes = await sql.get(`select count(*) as r from vote where pollId = ${reaction.message.id} and vote = "${array[i]}"`);
    resultsEmbed.addFields({name: "Option : " + array[i], value: "Nombre de votes : " + votes.r});
  }
}

/**
 * generate the start of the result embed
 * @param {*} reaction 
 */
function generateEmbedBegining(reaction) {
  let resultsEmbed = new EmbedBuilder();
  resultsEmbed.setTitle(":scroll: Resultat du sondage : ");
  resultsEmbed.setColor("#FFD983");
  resultsEmbed.setDescription("Cliquez ici pour retrouver le sondage : \n" + reaction.message.url);
  return resultsEmbed;
}

/**
 * Send a dm to notify an error
 * 
 * @param {*} reaction 
 */
function errorStopingPoll(reaction) {
  embed.setTitle(":x: Vous ne pouvez pas terminer ce sondage.");
  embed.setColor("#D92D43");
  embed.setDescription("Veuillez contacter la personne l'ayant lancé");
  reaction.users.cache.last().send(embed);
}

/**
 * Send a dm to confirm the vote was changed
 * @param {*} reaction 
 */
function confirmChangeVote(reaction) {
  embed.setTitle(":information_source: Votre vote a été modifié !");
  embed.setColor("#3B88C3");
  embed.setDescription("Vous votez désormais pour l'option " + reaction.emoji.name + ". Pour modifier (encore ?!) votre vote, cliquez sur un autre choix.");
  reaction.users.cache.last().send({embeds: [embed]});
}

/**
 * Send a dm to confirm the vote was saved
 * @param {*} reaction 
 */
function confirmVote(reaction) {
  embed.setTitle(":white_check_mark: Votre vote a été enregistré !");
  embed.setColor("#77B255");
  embed.setDescription("Vous avez voté pour l'option " + reaction.emoji.name + ". Pour modifier votre vote, cliquez sur un autre choix.");
  reaction.users.cache.last().send({embeds: [embed]});
}

async function getNumberOfVote(reaction) {
  let numberOfVoteByThisUserOnThisPoll = await sql.get(`select count(*) as number from vote where	authorId = ${reaction.users.cache.last().id} and pollId = ${reaction.message.id}`).catch(console.error);
  numberOfVoteByThisUserOnThisPoll = numberOfVoteByThisUserOnThisPoll.number;
  return numberOfVoteByThisUserOnThisPoll;
}

/**
 * check if the reaction has to be considered
 * @param {*} reaction 
 */
function reactionIsOnApoll(reaction) {
  return !reaction.users.cache.last().bot && reaction.message.author.id == client.user.id;
}

/**
 * delete the last reaction that was added
 * @param {*} reaction 
 */
function deleteLastReaction(reaction) {
  reaction.users.remove(reaction.users.cache.last());
}

/**
 * Save the vote to the database
 * @param {*} reaction 
 */
function saveVote(reaction) {
  sql.run(`INSERT INTO vote (pollId, authorId, vote) VALUES (${reaction.message.id},${reaction.users.cache.last().id},"${reaction.emoji.name}")`).catch(console.error);
}

/**
 * update the vote to the database
 * @param {*} reaction 
 */
function updateVote(reaction) {
  sql.run(`UPDATE vote set vote = "${reaction.emoji.name}" WHERE authorId = ${reaction.users.cache.last().id} and pollId = ${reaction.message.id}`).catch(console.error);
}

/**
 * Create the poll message
 * @param {*} interaction 
 */
async function repostTheQuestion(interaction) {
  let question = getQuestion(interaction);
  embed.setTitle(question);
  embed.setColor("#006D68");
  embed.setDescription("Utilisez les réactions ci-dessous pour répondre à la question. Utilisez la réaction 📜 pour visionner les résultats si vous êtes l'initiateur du sondage.");
  let msg;
  try {
    msg = await interaction.reply({embeds: [embed], fetchReply: true});
  }
  catch{
    embed.setTitle(":x: Erreur !");
    embed.setColor("#D92D43");
    embed.setDescription("La taille limite d'une question est de 256 caractères.");
    msg = await interaction.reply({embeds: [embed]});
  }
  return msg;
}

/**
 * add the reactions under the message
 * @param {*} interaction 
 * @param {*} msg 
 */
async function addReactions(interaction, msg) {
  if (isANumberPoll(interaction)) {
    await reactWithNumber(interaction, msg);
  }
  else {
    await reactWithYesNo(msg);
  }
  msg.react("📜");
}

/**
 * Save a new poll in the database
 * @param {*} interaction 
 * @param {*} msg
 */
function saveNewPoll(interaction, msg) {
  sql.run(`INSERT INTO poll (messageId, time, numberOfOptions,authorId) VALUES (${msg.id},${interaction.createdTimestamp},${interaction.options.getInteger('choices')},${interaction.user.id}) `).catch(console.error);
}

/**
 * get the question in a string
 * @param {*} interaction 
 */
function getQuestion(interaction) {
  return interaction.options.getString('question');
}

/**
 * display an error
 * @param {*} interaction 
 */
async function sendArgsErrorMessage(interaction) {
  embed.setTitle(":x: Erreur !");
  embed.setColor("#D92D43");
  embed.setDescription("Veuillez choisir un nombre d'options compris entre 2 et 10 : `?s [nombre d'option] Question`");
  return interaction.reply({embeds: [embed]});
}

/**
 * test the validitu of the args
 * @param {*} interaction 
 */
function argsIsNotValid(interaction) {
  const option = interaction.options.getInteger('choices')
  return parseInt(option) < 2 || parseInt(option) > 10 || isNaN(parseInt(option));
}

/**
 * test if the bot has a two choice poll
 * @param {*} msg 
 */
async function reactWithYesNo(msg) {
  await msg.react("✅");
  await msg.react("❌");
}

/**
 * React with numbers to the message 
 * @param {*} interaction 
 * @param {*} msg
 */
async function reactWithNumber(interaction, msg) {
  let = array = {
    "0": "1️⃣",
    "1": "2️⃣",
    "2": "3️⃣",
    "3": "4️⃣",
    "4": "5️⃣",
    "5": "6️⃣",
    "6": "7️⃣",
    "7": "8️⃣",
    "8": "9️⃣",
    "9": "🔟"
  };
  for (let i = 0; i < interaction.options.getInteger('choices'); i++) {
    await msg.react(array[i]);
  }
}

/**
 * test if a poll is a number poll
 * @param {*} interaction 
 */
function isANumberPoll(interaction) {
  const option = interaction.options.getInteger('choices');
  return option < 11 && option > 2;
}

  /**
  * This function create the database
  * @param sql - a sqlite file.
  */
function createDatabase(sql) {
    //first check if the database is not already there
    sql.get(`SELECT version FROM database`).catch(() => {
      sql.run("CREATE TABLE IF NOT EXISTS vote (pollId INTEGER, authorId INTEGER, vote TEXT)").catch(console.error);
      sql.run("CREATE TABLE IF NOT EXISTS poll (messageId INTEGER, time INTEGER, numberOfOptions INTEGER, authorId INTEGER)").catch(console.error);
      sql.run("CREATE TABLE IF NOT EXISTS database (version TEXT)").then(() => {
        sql.run(`INSERT INTO database (version) VALUES (1)`).then(() => {
          console.log("... Generation Complete !");
        });
      });
    }).then(() => {
      //the database is ok
      console.log('... Database is valid !');
    });
}

client.login(Config.DISCORD_CLIENT_TOKEN);