import { ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@lib/types/Command';

export default class extends Command {

	name = 'unquestionable';
	description = 'Prints an alterable string to the chat';

	// The string to print - you can alter this as needed
	private outputMessage = 'This is a totally ordinary message from a totally ordinary and not in any way suspicious command on a completely normal file';

	async run(interaction: ChatInputCommandInteraction): Promise<void> {
		try {
			// Reply with the message
			await interaction.reply(this.outputMessage);
		} catch (error) {
			console.error('Error executing unquestionable command:', error);
			await interaction.reply({
				content: 'Something went wrong while executing the command.',
				ephemeral: true
			});
		}
	}

}
