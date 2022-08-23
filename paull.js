const {EmbedBuilder, Client, GatewayIntentBits} = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const Config = require('./config');
const sql = require("sqlite");
const embed = new EmbedBuilder();

sql.open("./database.sqlite");

client.on("ready", () => {
    console.log("Bot démarré :) " + client.guilds.cache.size + " serveurs !");
    createDatabase(sql);
    client.user
    .setPresence({ activities: [{ name: '?s 2 Vous allez bien ?' }], status: 'online' })
});

/**
 * used ot get the amount of vote on a poll and edit the message
 * @param {*} reaction 
 */
 async function updatePollMessage(reaction) {
  let embedToEdit = reaction.message.embeds[0];
  console.log(embedToEdit);
  let number = await sql.get(`select count(*) as number from vote where pollId = ${reaction.message.id}`).catch(console.error);
  number = number.number;
  embedToEdit.setDescription("Utilisez les réactions ci-dessous pour répondre à la question. Utilisez la réaction 📜 pour visionner les résultats si vous êtes l'initiateur du sondage\n\n" + number + " vote(s) reçu(s).");
  reaction.message.edit(embedToEdit);
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
  reaction.message.channel.send(resultsEmbed);
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
  resultsEmbed.addField("Option : :white_check_mark:", "Nombre de votes : " + votes.r);
  votes = await sql.get(`select count(*) as r from vote where pollId = ${reaction.message.id} and vote = "❌"`);
  resultsEmbed.addField("Option : :x:", "Nombre de votes : " + votes.r);
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
    resultsEmbed.addField("Option : " + array[i], "Nombre de votes : " + votes.r);
  }
}

/**
 * generate the start of the result embed
 * @param {*} reaction 
 */
function generateEmbedBegining(reaction) {
  let resultsEmbed = new Discord.MessageEmbed();
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
  reaction.users.cache.last().send(embed);
}

/**
 * Send a dm to confirm the vote was saved
 * @param {*} reaction 
 */
function confirmVote(reaction) {
  embed.setTitle(":white_check_mark: Votre vote a été enregistré !");
  embed.setColor("#77B255");
  embed.setDescription("Vous avez voté pour l'option " + reaction.emoji.name + ". Pour modifier votre vote, cliquez sur un autre choix.");
  reaction.users.cache.last().send(embed);
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
 * @param {*} message 
 * @param {*} args 
 */
async function repostTheQuestion(message, args) {
  let question = getQuestion(message, args);
  embed.setTitle(question);
  embed.setColor("#006D68");
  embed.setDescription("Utilisez les réactions ci-dessous pour répondre à la question. Utilisez la réaction 📜 pour visionner les résultats si vous êtes l'initiateur du sondage.");
  let msg;
  try {
    msg = await message.channel.send(embed);
  }
  catch{
    embed.setTitle(":x: Erreur !");
    embed.setColor("#D92D43");
    embed.setDescription("La taille limite d'une question est de 256 caractères.");
    msg = await message.channel.send(embed);
  }
  message.delete();
  return msg;
}

/**
 * add the reactions under the message
 * @param {*} args 
 * @param {*} msg 
 */
async function addReactions(args, msg) {
  if (isANumberPoll(args)) {
    await reactWithNumber(args, msg);
  }
  else {
    await reactWithYesNo(msg);
  }
  msg.react("📜");
}

/**
 * Save a new poll in the database
 * @param {*} message 
 * @param {*} msg
 * @param {*} args 
 */
function saveNewPoll(message, msg, args) {
  sql.run(`INSERT INTO poll (messageId, time, numberOfOptions,authorId) VALUES (${msg.id},${message.createdTimestamp},${args[0]},${message.author.id}) `).catch(console.error);
}

/**
 * get the question in a string
 * @param {*} message 
 * @param {*} args 
 */
function getQuestion(message, args) {
  return message.content.slice(prefix.length).trim().slice(args[0].length);
}

/**
 * get an array of the args of the command
 * @param {*} message 
 */
function getArgs(message) {
  return message.content.slice(prefix.length).trim().split(/ +/g);
}

/**
 * display an error
 * @param {*} message 
 */
async function sendArgsErrorMessage(message) {
  embed.setTitle(":x: Erreur !");
  embed.setColor("#D92D43");
  embed.setDescription("Veuillez choisir un nombre d'options compris entre 2 et 10 : `?s [nombre d'option] Question`");
  return message.channel.send(embed);
}

/**
 * display an error
 * @param {*} message 
 */
async function sendQuestionErrorMessage(message) {
  embed.setTitle(":x: Erreur !");
  embed.setColor("#D92D43");
  embed.setDescription("Veuillez indiquer une question : `?s [nombre d'option] Question`");
  return message.channel.send(embed);
}

/**
 * test the validitu of the args
 * @param {*} args 
 */
function argsIsNotValid(args) {
  return parseInt(args[0]) < 2 || parseInt(args[0]) > 10 || isNaN(parseInt(args[0]));
}

/**
 * test if the bot has a two choice poll
 * @param {*} message 
 */
async function reactWithYesNo(message) {
  await message.react("✅");
  await message.react("❌");
}

/**
 * React with numbers to the message
 * @param {*} args 
 * @param {*} message 
 */
async function reactWithNumber(args, message) {
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
  for (let i = 0; i < args[0]; i++) {
    await message.react(array[i]);
  }
}

/**
 * test if a poll is a number poll
 * @param {*} args 
 */
function isANumberPoll(args) {
  return args[0] < 11 && args[0] > 2;
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