import {CacheType, CommandInteraction, EmbedBuilder, SlashCommandBuilder, User} from "discord.js";
import Service from "../../services/Service";
import CommandType from "../../models/CommandType";
import UserPortfolio from "src/models/user/UserPortfolio";

/**
 * TODO Stylize these responses with embeds.
 * I'm thinking a multiple pages approach, first page is your balance, net worth, and top 3 stocks,
 * The next pages are just lists of your stock holdings with quantity and value.
  */

const command: CommandType = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Displays your profile and portfolio information.'),
    async execute(interaction: CommandInteraction<CacheType>) {
        const service = Service.getInstance();
        const userPortfolio = await service.users.getUserPortfolio(interaction.user.id);
        if (!userPortfolio) {
            await interaction.reply('You do not have a profile yet.' + interaction.user.id);
            return;
        }

        await interaction.reply({ embeds: [generateProfileEmbed(userPortfolio, interaction.user)] });
    },
};

const generateProfileEmbed = (userPortfolio: UserPortfolio, user: User) => {
  const displayBalance = `$${userPortfolio.balance.toFixed(2)}`;
  const displayPortfolio = userPortfolio.portfolio.map(hs => `${hs.ticker}: ${hs.quantity}`).join(', ') || 'No stocks owned.';

  const embed = new EmbedBuilder()
    .setColor('#00c805')
    .setAuthor({ name: `${user.displayName}'s Profile`, iconURL: user.avatarURL() || undefined })
    .addFields(
      { name: 'Balance', value: displayBalance, inline: true },
      { name: 'Portfolio', value: displayPortfolio, inline: true },
    )
    return embed;
}

module.exports = command;