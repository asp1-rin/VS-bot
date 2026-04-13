const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const TOKEN = '';
const CLIENT_ID = '';
const DB_FILE = './database.json';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 4));
}

async function updateLiveRanking(guild, db) {
    if (!db.logChannelId) return;
    const channel = await guild.channels.fetch(db.logChannelId).catch(() => null);
    if (!channel) return;

    const sorted = Object.entries(db.users)
        .sort(([, a], [, b]) => b.rp - a.rp)
        .slice(0, 10);

    let description = '';
    for (let i = 0; i < sorted.length; i++) {
        const [id, data] = sorted[i];
        description += `**${i + 1}.** <@${id}>: ${data.rp} RP\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle('Live RP Ranking Top 10')
        .setDescription(description || 'No data')
        .setColor(0x00FFFF)
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}

const commands = [
    new SlashCommandBuilder()
        .setName('apply')
        .setDescription('Register and receive 1000 RP'),
    new SlashCommandBuilder()
        .setName('my')
        .setDescription('Check your current RP and rank'),
    new SlashCommandBuilder()
        .setName('vs')
        .setDescription('Record match result')
        .addUserOption(option => option.setName('winner').setDescription('The winner').setRequired(true))
        .addUserOption(option => option.setName('loser').setDescription('The loser').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('View top 10 RP ranking'),
    new SlashCommandBuilder()
        .setName('liverankinglog')
        .setDescription('Set the channel for live ranking logs')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    } catch (error) {
        console.error(error);
    }
    console.log('Bot is ready');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const db = readDB();
    const userId = interaction.user.id;

    if (interaction.commandName === 'apply') {
        if (db.users[userId]) {
            return interaction.reply({ content: 'You are already registered.', ephemeral: true });
        }
        db.users[userId] = { rp: 1000 };
        writeDB(db);
        await interaction.reply(`Registration complete. Your RP: 1000`);
    }

    if (interaction.commandName === 'my') {
        if (!db.users[userId]) {
            return interaction.reply({ content: 'You are not registered. Use /apply first.', ephemeral: true });
        }
        const sorted = Object.entries(db.users).sort(([, a], [, b]) => b.rp - a.rp);
        const rank = sorted.findIndex(([id]) => id === userId) + 1;
        await interaction.reply(`Your Rank: #${rank} | RP: ${db.users[userId].rp}`);
    }

    if (interaction.commandName === 'vs') {
        const winner = interaction.options.getUser('winner');
        const loser = interaction.options.getUser('loser');

        if (!db.users[winner.id] || !db.users[loser.id]) {
            return interaction.reply({ content: 'Both users must be registered.', ephemeral: true });
        }

        const diff = Math.abs(db.users[winner.id].rp - db.users[loser.id].rp);
        const changeAmount = Math.max(10, Math.floor(diff * 0.1));

        db.users[winner.id].rp += changeAmount;
        db.users[loser.id].rp = Math.max(0, db.users[loser.id].rp - changeAmount);
        
        writeDB(db);

        const embed = new EmbedBuilder()
            .setTitle('Match Result')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Winner', value: `${winner.username} (+${changeAmount} RP)\nTotal: ${db.users[winner.id].rp}`, inline: true },
                { name: 'Loser', value: `${loser.username} (-${changeAmount} RP)\nTotal: ${db.users[loser.id].rp}`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
        await updateLiveRanking(interaction.guild, db);
    }

    if (interaction.commandName === 'ranking') {
        const sorted = Object.entries(db.users)
            .sort(([, a], [, b]) => b.rp - a.rp)
            .slice(0, 10);

        if (sorted.length === 0) return interaction.reply('No registered users yet.');

        let description = '';
        for (let i = 0; i < sorted.length; i++) {
            const [id, data] = sorted[i];
            description += `**${i + 1}.** <@${id}>: ${data.rp} RP\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('RP Ranking TOP 10')
            .setDescription(description)
            .setColor(0xFFFF00);

        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'liverankinglog') {
        db.logChannelId = interaction.channelId;
        writeDB(db);
        await interaction.reply(`This channel has been set as the live ranking log channel.`);
    }
});

client.login(TOKEN);
