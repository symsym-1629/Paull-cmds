const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { DISCORD_CLIENT_TOKEN, DISCORD_CLIENT_ID } = require('./config');

const commands = [
	new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Creates a poll !')
    .addIntegerOption(option => option
        .setName('choices')
		.setDescription('How many choices for the poll ?')
		.setRequired(true)
    )
    .addStringOption(option => option
        .setName('question')
        .setDescription('What question do you want to ask ?')
        .setRequired(true)
    ),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_CLIENT_TOKEN);

rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);