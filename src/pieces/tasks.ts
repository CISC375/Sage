import { BOT, CHANNELS, DB } from '@root/config';
import { AttachmentBuilder, ChannelType, Client, EmbedBuilder, TextChannel } from 'discord.js';
import { schedule } from 'node-cron';
import { Reminder } from '@lib/types/Reminder';
import { Poll, PollResult } from '@lib/types/Poll';
import { MongoClient } from 'mongodb';
import { Job } from '../lib/types/Job';
import fetchJobListings from '../lib/utils/jobUtils/Adzuna_job_search';
import { sendToFile } from '../lib/utils/generalUtils';
import { JobData } from '../lib/types/JobData';
import { Interest } from '../lib/types/Interest';
import { JobResult } from '../lib/types/JobResult';

async function register(bot: Client): Promise<void> {
	schedule('0/30 * * * * *', () => {
		handleCron(bot).catch(async (error) => bot.emit('error', error));
	});
}

async function handleCron(bot: Client): Promise<void> {
	checkPolls(bot);
	checkReminders(bot);
}

async function checkPolls(bot: Client): Promise<void> {
	const polls: Poll[] = await bot.mongo.collection<Poll>(DB.POLLS).find({ expires: { $lte: new Date() } }).toArray();
	const emotes = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
	polls.forEach(async (poll) => {
		const mdTimestamp = `<t:${Math.floor(Date.now() / 1000)}:R>`;
		const resultMap = new Map<string, number>();
		let winners: PollResult[] = [];

		poll.results.forEach((res) => {
			resultMap.set(res.option, res.users.length);
			if (!winners[0]) {
				winners = [res];
				return;
			}
			if (winners[0] && res.users.length > winners[0].users.length) {
				winners = [res];
			} else if (res.users.length === winners[0].users.length) {
				winners.push(res);
			}
		});

		let winMessage: string;
		const winCount = winners[0].users.length;
		if (winCount === 0) {
			winMessage = 'It looks like no one has voted!';
		} else if (winners.length === 1) {
			winMessage = `**${winners[0].option}** has won the poll with ${winCount} vote${winCount === 1 ? '' : 's'}!`;
		} else {
			winMessage = `**${winners.slice(0, -1).map((win) => win.option).join(', ')} and ${
				winners.slice(-1)[0].option
			}** have won the poll with ${winCount} vote${winCount === 1 ? '' : 's'} each!`;
		}

		let choiceText = '';
		let count = 0;
		resultMap.forEach((value, key) => {
			choiceText += `${emotes[count++]} ${key}: ${value} vote${value === 1 ? '' : 's'}\n`;
		});

		const pollChannel = await bot.channels.fetch(poll.channel);
		if (pollChannel.type !== ChannelType.GuildText) {
			throw 'something went wrong fetching the poll\'s channel';
		}

		const pollMsg = await pollChannel.messages.fetch(poll.message);
		const owner = await pollMsg.guild.members.fetch(poll.owner);
		const pollEmbed = new EmbedBuilder().setTitle(poll.question).setDescription(`This poll was created by ${owner.displayName} and ended **${mdTimestamp}**`).addFields({ name: `Winner${winners.length
			=== 1 ? '' : 's'}`, value: winMessage }).addFields({ name: 'Choices', value: choiceText }).setColor('Random');

		pollMsg.edit({ embeds: [pollEmbed], components: [] });

		pollMsg.channel.send({
			embeds: [
				new EmbedBuilder().setTitle(poll.question).setDescription(`${owner}'s poll has ended!`).addFields({ name: `Winner${winners.length === 1 ? '' : 's'}`, value: winMessage }).addFields({ name:
					'Original poll', value: `Click [here](${pollMsg.url}) to see the original poll.` }).setColor('Random')
			]
		});

		await bot.mongo.collection<Poll>(DB.POLLS).findOneAndDelete(poll);
	});
}

// eslint-disable-next-line no-warning-comments
async function getJobFormData(userID:string, filterBy: string):Promise<[JobData, Interest, JobResult[]]> {
	const client = await MongoClient.connect(DB.CONNECTION, { useUnifiedTopology: true });
	const db = client.db(BOT.NAME).collection(DB.JOB_FORMS);
	const jobformAnswers:Job[] = await db.find({ owner: userID }).toArray();
	const jobData:JobData = {
		city: jobformAnswers[0].answers[0],
		preference: jobformAnswers[0].answers[1],
		jobType: jobformAnswers[0].answers[2],
		distance: jobformAnswers[0].answers[3],
		filterBy: filterBy ?? 'default'
	};

	const interests:Interest = {
		interest1: jobformAnswers[1].answers[0],
		interest2: jobformAnswers[1].answers[1],
		interest3: jobformAnswers[1].answers[2],
		interest4: jobformAnswers[1].answers[3],
		interest5: jobformAnswers[1].answers[4]
	};

	const APIResponse:JobResult[] = await fetchJobListings(jobData, interests);
	return [jobData, interests, APIResponse];
}

function formatCurrency(currency:number): string {
	return isNaN(currency) ? 'N/A' : `${new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(Number(currency))}`;
}

function titleCase(jobTitle:string): string {
	return jobTitle.toLowerCase().replace(/[()]/g, '').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function listJobs(jobData: JobResult[], filterBy: string): string {
	// Conditionally sort jobs by salary if sortBy is 'salary'
	if (filterBy === 'salary') {
		jobData.sort((a, b) => {
			const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
			const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;

			// Handle cases where salaryMax or salaryMin is "Not listed"
			if (isNaN(avgA)) return 1; // Treat jobs with no salary info as lowest
			if (isNaN(avgB)) return -1;

			return avgB - avgA; // Descending order
		});
	}

	let jobList = '';
	for (let i = 0; i < jobData.length; i++) {
		const avgSalary = (Number(jobData[i].salaryMax) + Number(jobData[i].salaryMin)) / 2;
		const formattedAvgSalary = formatCurrency(avgSalary);
		const formattedSalaryMax = formatCurrency(Number(jobData[i].salaryMax)) !== 'N/A' ? formatCurrency(Number(jobData[i].salaryMax)) : '';
		const formattedSalaryMin = formatCurrency(Number(jobData[i].salaryMin)) !== 'N/A' ? formatCurrency(Number(jobData[i].salaryMin)) : '';

		const salaryDetails = (formattedSalaryMin && formattedSalaryMax)
			? `, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
			: formattedAvgSalary;

		jobList += `${i + 1}. **${titleCase(jobData[i].title)}**  
		  \t\t* **Salary Average:** ${formattedAvgSalary}${salaryDetails}  
		  \t\t* **Location:** ${jobData[i].location}  
		  \t\t* **Apply here:** [read more about the job and apply here](${jobData[i].link})  
		  ${i !== jobData.length - 1 ? '\n' : ''}`;
	}

	return jobList || '### Unfortunately, there were no jobs found based on your interests :(. Consider updating your interests or waiting until something is found.';
}

async function jobMessage(reminder: Reminder, userID: string): Promise<string> {
	const jobFormData: [JobData, Interest, JobResult[]] = await getJobFormData(userID, reminder.filterBy);
	const message = `## Hey <@${reminder.owner}>!  
	## Here's your list of job/internship recommendations:  
	Based on your interests in **${jobFormData[1].interest1}**, **${jobFormData[1].interest2}**, \
	**${jobFormData[1].interest3}**, **${jobFormData[1].interest4}**, and **${jobFormData[1].interest5}**, I've found these jobs you may find interesting. Please note that while you may get\
	job/internship recommendations from the same company,\
	their positions/details/applications/salary WILL be different and this is not a glitch/bug!
	Here's your personalized list:

	${listJobs(jobFormData[2], reminder.filterBy)}
	---  
	### **Disclaimer:**  
	-# Please be aware that the job listings displayed are retrieved from a third-party API. \
	While we strive to provide accurate information, we cannot guarantee the legitimacy or security\
	of all postings. Exercise caution when sharing personal information, submitting resumes, or registering\
	on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
	some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
	`;
	return message;
}

function stripMarkdown(message: string, owner: string): string {
	return message
		.replace(new RegExp(`## Hey <@${owner}>!\\s*## Here's your list of job/internship recommendations:?`, 'g'), '') // Remove specific header
		.replace(/\[read more about the job and apply here\]/g, '')
		.replace(/\((https?:\/\/[^\s)]+)\)/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/##+\s*/g, '')
		// eslint-disable-next-line no-useless-escape
		.replace(/###|-\#\s*/g, '')
		.trim();
}

function headerMessage(owner:string, filterBy:string):string {
	return `## Hey <@${owner}>!  
	### **__Please read this disclaimer before reading your list of jobs/internships__:**  
-# Please be aware that the job listings displayed are retrieved from a third-party API. \
While we strive to provide accurate information, we cannot guarantee the legitimacy or security \
of all postings. Exercise caution when sharing personal information, submitting resumes, or registering \
on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
## Here's your list of job/internship recommendations${filterBy && filterBy !== 'default' ? ` (filtered based on ${filterBy === 'date' ? 'date posted' : filterBy}):` : ':'}
	`;
}

async function checkReminders(bot: Client): Promise<void> {
	const reminders: Reminder[] = await bot.mongo.collection(DB.REMINDERS).find({ expires: { $lte: new Date() } }).toArray();
	const pubChan = (await bot.channels.fetch(CHANNELS.SAGE)) as TextChannel;

	reminders.forEach((reminder) => {
		if (reminder.mode === 'public') {
			pubChan.send(`<@${reminder.owner}>, here's the reminder you asked for: **${reminder.content}**`);
		} else {
			bot.users.fetch(reminder.owner).then(async (user) => {
				const message = await jobMessage(reminder, user.id);
				if (message.length < 2000) {
					user.send(message).catch((err) => {
						console.log('ERROR:', err);
						pubChan.send(
							`<@${reminder.owner}>, I tried to send you a DM about your private reminder but it looks like you have DMs closed. Please enable DMs in the future if 
							you'd like to get private reminders.`
						);
					});
				} else {
					const attachments: AttachmentBuilder[] = [];
					attachments.push(await sendToFile(stripMarkdown(message.split('---')[0], reminder.owner), 'txt', 'list-of-jobs-internships', false));
					user.send({ content: headerMessage(reminder.owner, reminder.filterBy), files: attachments as AttachmentBuilder[] });
				}
			}).catch((error) => {
				console.log('ERROR CALLED ----------------------------------------------------');
				console.error(`Failed to fetch user with ID: ${reminder.owner}`, error);
			});
		}

		const newReminder: Reminder = {
			content: reminder.content,
			expires: new Date(reminder.expires),
			mode: reminder.mode,
			repeat: reminder.repeat,
			owner: reminder.owner
		};

		if (reminder.repeat === 'daily') {
			newReminder.expires.setDate(reminder.expires.getDate() + 1);
			bot.mongo.collection(DB.REMINDERS).findOneAndReplace(reminder, newReminder);
		} else if (reminder.repeat === 'weekly') {
			newReminder.expires.setDate(reminder.expires.getDate() + 7);
			bot.mongo.collection(DB.REMINDERS).findOneAndReplace(reminder, newReminder);
		} else {
			bot.mongo.collection(DB.REMINDERS).findOneAndDelete(reminder);
		}
	});
}

export default register;
