import { BOT, DB } from '@root/config';
import {
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	InteractionResponse
} from 'discord.js';
import { Reminder } from '@lib/types/Reminder';
import parse from 'parse-duration';
import { reminderTime } from '@root/src/lib/utils/generalUtils';
import { Command } from '@lib/types/Command';

export default class extends Command {

	description = `Have ${BOT.NAME} give you a reminder.`;
	extendedHelp = 'Reminders can be set to repeat daily or weekly.';
	options: ApplicationCommandOptionData[] = [
		{
			name: 'create',
			description: 'Create a reminder',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'content',
					description: 'What you\'d like to be reminded of',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'duration',
					description: 'When you\'d like to be reminded',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'repeat',
					description: 'How often you want the reminder to repeat',
					choices: [
						{ name: 'Daily', value: 'daily' },
						{ name: 'Weekly', value: 'weekly' }
					],
					type: ApplicationCommandOptionType.String,
					required: false
				}
			]
		},
		// added by Fried Sage Leaves - handles what happens when /remind jobs is run
		{
			name: 'jobs',
			description: 'Create a job reminder',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'job-repeat',
					description: 'How often you want the reminder to repeat',
					choices: [
						{ name: 'Daily', value: 'daily' },
						{ name: 'Weekly', value: 'weekly' }
					],
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'filter-type',
					description: 'Select what you would like your job/internships filtered by',
					choices: [
						{ name: 'Relevance', value: 'relevance' },
						{ name: 'Salary', value: 'salary' },
						{ name: 'Date Posted', value: 'date' },
						{ name: 'Default', value: 'default' }
					],
					type: ApplicationCommandOptionType.String
				}
			]
		}
	];

	async checkJobReminder(
		interaction: ChatInputCommandInteraction
	): Promise<boolean> {
		const reminders: Array<Reminder> = await interaction.client.mongo
			.collection(DB.REMINDERS)
			.find({ owner: interaction.user.id })
			.toArray();

		return reminders.some(
			(reminder: Reminder) => reminder.content === 'Job Reminder'
		);
	}

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<InteractionResponse<boolean> | void> {
		const subcommand: string = interaction.options.getSubcommand();

		if (subcommand === 'jobs') {
			const jobReminderRepeat = interaction.options.getString('job-repeat') as
					| 'daily'
					| 'weekly' || null;

			const filterBy = interaction.options.getString('filter-type') as 'relevance' | 'salary' | 'date' | 'default' | null;

			const jobReminder: Reminder = {
				owner: interaction.user.id,
				content: 'Job Reminder',
				mode: 'private',
				expires: new Date(),
				repeat: jobReminderRepeat,
				filterBy
			};
			// handling duplicate job reminders
			if (await this.checkJobReminder(interaction)) {
				return interaction.reply({
					content:
						'You currently already have a job reminder set. To clear your existing job reminder, run `/cancelreminder` and provide the reminder number.',
					ephemeral: true
				});
			} else {
				interaction.client.mongo
					.collection(DB.REMINDERS)
					.insertOne(jobReminder);
				return interaction.reply({
					content: `I'll remind you about job offers ${jobReminderRepeat} at ${reminderTime(
						jobReminder
					)}.`,
					ephemeral: true
				});
			}
		} else {
			const content = interaction.options.getString('content');
			const rawDuration = interaction.options.getString('duration');
			const duration = parse(rawDuration);
			const repeat = interaction.options.getString('repeat') as
					| 'daily'
					| 'weekly' || null;

			if (!duration) {
				return interaction.reply({
					content: `**${rawDuration}** is not a valid duration. You can use words like hours, minutes, seconds, days, weeks, months, or years.`,
					ephemeral: true
				});
			}
			const reminder: Reminder = {
				owner: interaction.user.id,
				content,
				mode: 'public', // temporary
				expires: new Date(duration + Date.now()),
				repeat
			};
			interaction.client.mongo
				.collection(DB.REMINDERS)
				.insertOne(reminder);
			return interaction.reply({
				content: `I'll remind you about that at ${reminderTime(
					reminder
				)}.`,
				ephemeral: true
			});
		}
	}

}
