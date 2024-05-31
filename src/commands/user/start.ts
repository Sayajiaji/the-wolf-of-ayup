import CommandType from "../../models/CommandType";
import {CacheType, CommandInteraction, SlashCommandBuilder} from "discord.js";
import Service from "../../services/Service";
import User from "../../models/user/User";

const command: CommandType = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('Creates a profile for you and/or starts a tutorial.'),
    async execute(interaction: CommandInteraction<CacheType>) {
        const service = Service.getInstance();
        const user = await service.users.getUser(interaction.user.id);
        if (!user) {
            const newUser: User = {
                uid: interaction.user.id,
                balance: 1000,
            };
            await service.users.createUser(newUser);
            await interaction.reply('PLACEHOLDER: Created a profile for you with $1000.');
        }

        // TODO start tutorial
    },
};

module.exports = command;