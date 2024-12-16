import { Command } from '@root/src/lib/types/Command';
import {
	ActionRowBuilder,
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	InteractionResponse,
	ModalBuilder,
	ModalSubmitFields,
	TextInputBuilder,
	TextInputStyle
} from 'discord.js';
import { validatePreferences } from '../../lib/utils/jobUtils/validatePreferences';

// prettier-ignore
// Questions users will be asked to input into the API
const questions = [
	[
		'What city do you want to be located?',
		'Remote, hybrid, and/or in-person?',
		'Full time, Part time, and/or Internship?',
		'How far are you willing to travel? (in miles)'
	],
	['Interest 1', 'Interest 2', 'Interest 3', 'Interest 4', 'Interest 5']
];

// prettier-ignore
export default class extends Command {

	name = 'jobform';
	description = 'Form to get your preferences for jobs to be used with the Job Alert System!';

	// Gives option to command to choose what question set user is answering.
	options: ApplicationCommandOptionData[] = [
		{
			name: 'qset',
			description: 'Which question set do you want to view (1 or 2).',
			type: ApplicationCommandOptionType.Number,
			required: true,
			choices: [
				{ name: 'qset 1', value: 1 },
				{ name: 'qset 2', value: 2 }
			]
		}
	];

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const questionSet = interaction.options.getNumber('qset') - 1;

		if (questionSet !== 0 && questionSet !== 1) {
			await interaction.reply({ content: 'Please enter either 1 or 2' });
			return;
		}

		// Creates the modal that pops up once the command is run, giving it the correct title and set of questions.
		const modal = new ModalBuilder()
			.setCustomId(`jobModal${questionSet}`)
			.setTitle(`Job Form (${questionSet + 1} of 2)`);

		const askedQuestions = questions[questionSet];
		const rows = askedQuestions.map((question) =>
			this.getAnswerField(question, askedQuestions.indexOf(question))
		);

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
	// Creates the interface where the user can anwer the questions.
	getAnswerField(question: string, questionNum: number): ActionRowBuilder {
		return new ActionRowBuilder({ components: [new TextInputBuilder()
			.setCustomId(`question${questionNum + 1}`)
			.setLabel(`${question}`)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Input Answer Here')
			.setRequired(true)
		] });
	}
	// Handles validation for qset1
	async handleModalSubmit(interaction: ChatInputCommandInteraction, answers: string[], qSet: number): Promise<boolean> {
		const validation = validatePreferences(answers, qSet, true);
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
