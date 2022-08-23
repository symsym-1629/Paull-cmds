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

client.on("interactionCreate", async (interaction) => {

    if (interaction.mentions.users.last() && interaction.mentions.users.last().id == client.user.id) {
      let embed = new EmbedBuilder();
      embed.setTitle(":information_source: Je suis maintenant en slash commands !");
      embed.setDescription("Si vous avez besoin de plus d'assistance, rejoignez le discord d'aide : https://discord.gg/GWTFMQv");
      interaction.channel.send(embed);
    }
});

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