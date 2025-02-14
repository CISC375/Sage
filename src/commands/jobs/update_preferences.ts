import { DB } from '@root/config';
import { Command } from '@root/src/lib/types/Command';
import { validatePreferences } from '@root/src/lib/utils/jobUtils/validatePreferences';
import { ActionRowBuilder, ApplicationCommandOptionData, ApplicationCommandOptionType,
	ChatInputCommandInteraction, InteractionResponse, ModalBuilder, ModalSubmitFields,
	TextInputBuilder, TextInputStyle } from 'discord.js';

// Questions users will be asked to input into the API
const questions = [
	['What city do you want to be located?',
		'Remote, hybrid, and/or in-person?',
		'Full time, Part time, and/or Internship?',
		'How far are you willing to travel? (in miles)'],
	['Interest 1', 'Interest 2', 'Interest 3', 'Interest 4', 'Interest 5']
];

export default class extends Command {

	name = 'update_preferences'
	description = 'View and update your preferences for jobs to be used with the Job Alert System!';

	// Gives option to command to choose what question set user is answering.
	options: ApplicationCommandOptionData[] = [
		{
			name: 'qset',
			description: 'Which question set do you want to view and update(1 or 2)?',
			type: ApplicationCommandOptionType.Number,
			required: true,
			choices: [
				{ name: 'qset 1', value: 1 },
				{ name: 'qset 2', value: 2 }
			]
		}
	]

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const questionSet = interaction.options.getNumber('qset') - 1;

		if (questionSet !== 0 && questionSet !== 1) {
			await interaction.reply({ content: 'Please enter either 1 or 2' });
			return;
		}

		// Checks if user has done the job form at least once
		const existingAnswers = await interaction.client.mongo.collection(DB.USERS).findOne({
			discordId: interaction.user.id,
			jobPreferences: { $exists: true }
		});

		// directs user to do /jobform first since they have no preferences to update
		if (!existingAnswers) {
			interaction.reply({
				content: 'No preferences found, enter preferences by using the command /jobform',
				ephemeral: true
			});
			return;
		}
		const currentAns = existingAnswers.jobPreferences?.answers;
		const askedQuestions = questions[questionSet];
		// If questions changed, making sure to update these titles to correctly describe question.
		const quesChoices = questionSet === 0
			? ['city', 'workType', 'employmentType', 'travelDistance']
			: ['interest1', 'interest2', 'interest3', 'interest4', 'interest5'];

		const rows = askedQuestions.map((question) => {
			let value = '';
			if (currentAns) {
				value = currentAns[quesChoices[askedQuestions.indexOf(question)]] || '';
			}
			return this.getAnswerField(question, askedQuestions.indexOf(question), value);
		});

		// Creates the modal that pops up once the command is run, giving it the correct title and set of questions.
		const modal = new ModalBuilder()
			.setCustomId(`updateModal${questionSet}`)
			.setTitle(`Update Job Preferences (${questionSet + 1} of 2)`);


		for (const row of rows) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			modal.addComponents(row);
		}

		await interaction.showModal(modal);

		return;
	}


	getAnswer(fields: ModalSubmitFields, questionNum: number): string {
		return fields.getField(`question${questionNum + 1}`).value;
	}

	// Creates the interface where the user can view and answer the questions.
	getAnswerField(question: string, questionNum: number, value: string): ActionRowBuilder {
		return new ActionRowBuilder({ components: [new TextInputBuilder()
			.setCustomId(`question${questionNum + 1}`)
			.setLabel(`${question}`)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(`Current value: ${value || 'Not Set'}`)
			.setRequired(false)] });
	}
	// Handles validation for qset1
	async handleModalSubmit(interaction: ChatInputCommandInteraction, answers: string[], qSet: number): Promise<boolean> {
		const validation = validatePreferences(answers, qSet, false);
		if (!validation.isValid) {
			await interaction.reply({ content: `Form validation failed:\n${validation.errors.join('\n')}`,
				ephemeral: true });
			return;
		}
		await interaction.reply({
			content: 'Form submitted successfully!',
			ephemeral: true
		});
	}

}
