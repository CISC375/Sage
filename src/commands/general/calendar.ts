/* eslint-disable */
/* 
This is the /Calendar command. This command connects SAGE to Google Calendar to pull up the events listed in a master calendar so that one may review it
without needing to open yet another web page. This command requires a few things to work:
- Email authentication, which will rewrite data in the `credentials.json` file.
- The calendar ID of the calendar you want to pull events from, which you can find in the settings menu for a calendar in Google Calendar (website).

To authenticate your email:
1. Delete the `token.json` file if it exists.
2. Add the desired calendar ID in the intended location within the code, identified below.
3. Run the command once you start SAGE.
4. A new tab will open asking for your email, enter it and confirm.
5. Once confirmed completely, close the window and return to discord.
6. Call the command once to ensure you have properly authenticated your email.

The command uses Google OAuth2 to fetch the events from the calendar, requiring permissions to read calendar data. 
It supports displaying events in Discord with pagination for easier navigation.

---

Key Features:
- **Fetch Events:** Retrieves events scheduled in the next 10 days from the specified Google Calendar.
- **Pagination:** Displays events in pages with navigation buttons (`Previous`, `Next`, and `Done`).
- **DM Display:** Sends the calendar events to the user's direct messages for private review.
- **Error Handling:** Notifies the user in case of authentication or retrieval errors.

Setup Instructions:
1. Ensure you have all required files, especially config.ts.
2. If you need to create a new bot to test things, using the Discord Developer Portal, add a bot as an application and follow the setup process 
they describe.
3. Navigate to config.ts and replace the bot token under const BOT.
4. in config.ts, modify the GUILDS, ROLES, and CHANNELS constants as needed.
5. Replace the calendar ID (if needed) with the ID of the calendar you want the bot to retrieve events from in this file.
6. Authenticate your email using the process described above.
7. Run some basic tests to ensure the bot has been setup properly, such as navigation and manual termination.

Limitations:
- The command fetches events only for the next 10 days.
- Pagination is limited to three events per page.
- The command will terminate after 5 minutes, which will prevent the buttons from working,
but the current page will remain visible as long as you remain in the DM from the bot.
-authorization only lasts for a few weeks until you need to authenticate again
*/
import {
	ChatInputCommandInteraction,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
	EmbedBuilder,
	ApplicationCommandOptionType,
	ApplicationCommandStringOptionData,
} from 'discord.js';
import { Command } from '@lib/types/Command';
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import event from '@root/src/models/calEvent';


const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

/*
Below is the class definition for the /Calendar command. This class is structured as an extension of the Command class.
It contains methods for:
- Loading existing credentials.
- Authenticating new credentials if needed.
- Formatting event data for display.
- Generating embeds and managing pagination.
- Handling button interactions to navigate through event pages.
*/ 

interface Event{
	eventId: string;
	courseID: string;
	instructor: string;
	date: string; 
	start: string;
	end: string;
	location: string;
	locationType: string; 
}
export default class extends Command {
	name = 'calendar'; // Command name
	description = 'Retrieve calendar events over the next 10 days with pagination, optionally filter'; // Command description

	// All available filters that someone can add and they are not required
	options: ApplicationCommandStringOptionData[] = [
		{
			type: ApplicationCommandOptionType.String,
			name: 'classname',
			description: 'Enter the class name to filter events (e.g., "cisc123")',
			required: false,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'locationtype',
			description: 'Enter "IP" for In-Person or "V" for Virtual events',
			required: false,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'eventholder',
			description: 'Enter the name of the event holder you are looking for.',
			required: false,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'eventdate',
			description: 'Enter the name of the date you are looking for with: [month name] [day] (eg., "december 12").',
			required: false,
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'dayofweek',
			description: 'Enter the day of the week to filter events (e.g., "Monday")',
			required: false,
		},
	];

	async run(interaction: ChatInputCommandInteraction): Promise<void> {
		const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']; // Required Google Calendar API scope
		const TOKEN_PATH = path.join(process.cwd(), 'token.json'); // Path to store authentication tokens
		const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json'); // Path to credentials file

		// Loads saved credentials if they exist
		async function loadSavedCredentialsIfExist() {
			try {
				const content = await fs.readFile(TOKEN_PATH); // Read token 
				const credentials = JSON.parse(content); //Parse credentials
				return google.auth.fromJSON(credentials); //Return
			} catch {
				return null; //return null if no credentials exist
			}
		}

		// Saves calendar access token.json into its own file when authenticating and credentials are saved to credentials.json for future use
		async function saveCredentials(client) {
			const content = await fs.readFile(CREDENTIALS_PATH);//read credentials.json
			const keys = JSON.parse(content);//parse the JSON file
			const key = keys.installed || keys.web;//extract the credentials data
			const payload = JSON.stringify({
				type: 'authorized_user',
				client_id: key.client_id,
				client_secret: key.client_secret,
				refresh_token: client.credentials.refresh_token,
			});
			await fs.writeFile(TOKEN_PATH, payload);//write token to credentials.json
		}

		// Loads the credentials that were authenticated by the user on their first use
		async function authorize() {
			let client = await loadSavedCredentialsIfExist();//attempt to load saved credentials
			if (client) {
				return client;//return if credentials exist
			}
			client = await authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });//save credentials for reuse
			if (client.credentials) {
				await saveCredentials(client);//return authenticated client
			}
			return client;
		}

		// Formats the date and time for events into readable string
		function formatDateTime(dateTime?: string): string {
			if (!dateTime) return '`NONE`';//return "none" is dateTime is undefined
			const date = new Date(dateTime);//parse date string
			return date.toLocaleString('en-US', {//format date
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				timeZoneName: 'short',
			});
		}

		/**
		 * MongoDB connection variables. This is where you would add in the connection string to your own MongoDB database, as well as establishing 
		 * the collection you want the events to be saved to within that database. It is currently set up to store events in the database of the bot
		 * which is running this command (Lineages), but feel free to make a specific database for the events or switch to your bot's database. 
		 */

		const connString = process.env.DB_CONN_STRING;
		const client = await MongoClient.connect(connString);
		const db = client.db('Lineages');
		const eventsCollection = db.collection('events');

		// Get the class name and location type arguments (if any)
		const className = interaction.options.getString('classname') || '';
		const locationType = interaction.options.getString('locationtype')?.toUpperCase() || '';
		const eventHolder = interaction.options.getString('eventholder') || '';
		const eventDate = interaction.options.getString('eventdate') || '';
		const dayOfWeek = interaction.options.getString('dayofweek')?.toLowerCase() || '';

		// Regex to validate that the class name starts with 'cisc' followed by exactly 3 digits
		const classNameRegex = /^cisc\d{3}$/i;
		// Validates the date format to make sure it is valid input
		const dateRegex = /^(?:january|february|march|april|may|june|july|august|september|october|november|december) (\d{1,2})$/;

		// Validate class name format
		if (className && !classNameRegex.test(className)) {
			await interaction.reply({
				content: 'Invalid class name format. Please enter a class name starting with "cisc" followed by exactly three digits (e.g., "cisc123").',
				ephemeral: true, // Only visible to the user who entered the command
			});
			return;
		}

		// Map to get the day of the week from the date
		const daysOfWeekMap: { [key: string]: number } = {
			sunday: 0,
			monday: 1,
			tuesday: 2,
			wednesday: 3,
			thursday: 4,
			friday: 5,
			saturday: 6,
		};

		// Validate locationType input ("IP" for In-Person, "V" for Virtual)
		if (locationType && !['IP', 'V'].includes(locationType)) {
			await interaction.reply({
				content: 'Invalid location type. Please enter "IP" for In-Person or "V" for Virtual events.',
				ephemeral: true, // Only visible to the user who entered the command
			});
			return;
		}

		// Makes sure the month is valid, otherwise it will not execute
		if (eventDate && !dateRegex.test(eventDate)) {
			await interaction.reply({
				content: 'Invalid date format. Please enter a date starting with "month" followed by 1-2 digits (e.g., "december 9").',
				ephemeral: true, // Only visible to the user who entered the command
			});
			return;
		}
		// Fetch and list calendar events
		async function listEvents(auth, interaction: ChatInputCommandInteraction, className: string, locationType: string) {
			const calendar = google.calendar({ version: 'v3', auth });
			const now = new Date();
			const timeMin = now.toISOString();
			const timeMax = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
			
			try {
				const res = await calendar.events.list({
					//THE ISOLATED LINE IS WHERE YOU SHOULD PUT YOUR CALENDAR ID
					calendarId: 'c_dd28a9977da52689612627d786654e9914d35324f7fcfc928a7aab294a4a7ce3@group.calendar.google.com',
					timeMin,
					timeMax,
					singleEvents: true,
					orderBy: 'startTime',
				});

				

				const events = res.data.items || [];//retrieve event items
				if (events.length === 0) {
					await interaction.followUp('No events found over the next 10 days.');
					return;
				}
				/**
				 * before filtering the events, we store every single one in MongoDB. 
				 */
				//parse events into readable format
				for (const event of events) {
					const eventParts = event.summary.split('-');
					const eventData: Event = {
						eventId: event.id,
						courseID: eventParts[0]?.trim() || '',
						instructor: eventParts[1]?.trim() || '',
						date: formatDateTime(event.start?.dateTime || event.start?.date),
						start: event.start?.dateTime || event.start?.date || '',
						end: event.end?.dateTime || event.end?.date || '',
						location: event.location || '',
						locationType: eventParts[2]?.trim().toLowerCase().includes('virtual') ? 'V' : 'IP'
					};
		
					try {
						// Update or insert the event
						await eventsCollection.updateOne(
							{ eventId: eventData.eventId },
							{ $set: eventData },
							{ upsert: true }
						);
					} catch (dbError) {
						console.error('Error storing event in database:', dbError);
					}
				}
				

				// Filters are provided, filter events by the ones given by user
				const filteredEvents = events.filter((event) => {
					let matchClassName = true;
					let matchLocationType = true;
					let matchEventHolder = true;
					let matchEventDate = true;
					let matchDayOfWeek = true;

					// Class name filter
					if (className) {
						matchClassName = event.summary && event.summary.toLowerCase().includes(className.toLowerCase());
					}

					// Event date filter
					if (eventDate) {
						const formattedEventDate = formatDateTime(event.start?.dateTime.toLowerCase());
						matchEventDate = formattedEventDate && formattedEventDate.toLowerCase().includes(eventDate.toLowerCase());
					}

					// Day of the week filter
					if (dayOfWeek) {
						const eventDate = new Date(event.start?.dateTime || event.start?.date);
						const eventDayOfWeek = eventDate.getDay();
						matchDayOfWeek = eventDayOfWeek === daysOfWeekMap[dayOfWeek];
					}

					// Location type filter (In-Person or Virtual)
					if (locationType) {
						if (locationType === 'IP') {
							matchLocationType = event.summary && event.summary.toLowerCase().includes('in person');
						} else if (locationType === 'V') {
							matchLocationType = event.summary && event.summary.toLowerCase().includes('virtual');
						}
					}

					// Event holder name filter
					if (eventHolder) {
						matchEventHolder = event.summary && event.summary.toLowerCase().includes(eventHolder.toLowerCase());
					}

					return matchClassName && matchLocationType && matchEventHolder && matchEventDate && matchDayOfWeek;
				});

				if (filteredEvents.length === 0) {
					await interaction.followUp('No events found matching the specified filters.');
					return;
				}

				// Puts the event object into stringified fields for printing
				const parsedEvents = filteredEvents.map((event, index) => ({
					name: (event.summary.split('-'))[0] || `Event ${index + 1}`,
					eventHolder: (event.summary.split('-'))[1],
					eventType: (event.summary.split('-'))[2],
					start: formatDateTime(event.start?.dateTime || event.start?.date),
					end: formatDateTime(event.end?.dateTime || event.end?.date),
					location: event.location || '`NONE`',
				}));

				// Display to the user with 3 events per page with a prev/next button to look through
				let currentPage = 0;
				const EVENTS_PER_PAGE = 3;
				// Generate embed message for a specific page
				function generateEmbed(page: number): EmbedBuilder {
					const embed = new EmbedBuilder()
						.setColor('Green')
						.setTitle(`Upcoming Events ${className ? `for ${className}` : ''} (${locationType ? locationType === 'IP' ? 'In-Person' : 'Virtual' : ''}) (Page ${page + 1} of ${Math.ceil(parsedEvents.length / EVENTS_PER_PAGE)})`);

					parsedEvents
						.slice(page * EVENTS_PER_PAGE, (page + 1) * EVENTS_PER_PAGE)
						.forEach((event, index) => {
							embed.addFields({
								name: `Event ${page * EVENTS_PER_PAGE + index + 1}: ${event.name}`,
								value: `**Event Holder:** ${event.eventHolder}\n**Start:** ${event.start}\n**End:** ${event.end}\n**Location:** ${event.location}\n**Event Type:** ${event.eventType}\n\n`,//add event
							});
						});

					return embed;
				}
				/* 
				Below are functions to update the message with navigation and handle button interactions. 
				These allow users to navigate pages or terminate the interaction.
				*/

				// Update the message with a new embed
				async function updateMessage(page: number, message) {
					const embed = generateEmbed(page);
					const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setCustomId('prev')
							.setLabel('Previous')
							.setStyle(ButtonStyle.Primary)
							.setDisabled(page === 0),//disable previous on first page
						new ButtonBuilder()
							.setCustomId('next')
							.setLabel('Next')
							.setStyle(ButtonStyle.Primary)
							.setDisabled(page === Math.ceil(parsedEvents.length / EVENTS_PER_PAGE) - 1),
						new ButtonBuilder()
							.setCustomId('done')
							.setLabel('Done')
							.setStyle(ButtonStyle.Danger)//add done button to interaction
					);

					await message.edit({ embeds: [embed], components: [buttons] });//update the message with new embed buttons
				}

				// Send initial message via DM
				const dmChannel = await interaction.user.createDM();//create DM channel
				const initialEmbed = generateEmbed(currentPage);
				const initialButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(//generate first embed page
					new ButtonBuilder()
						.setCustomId('prev')
						.setLabel('Previous')
						.setStyle(ButtonStyle.Primary)
						.setDisabled(true),
					new ButtonBuilder()
						.setCustomId('next')
						.setLabel('Next')
						.setStyle(ButtonStyle.Primary)
						.setDisabled(filteredEvents.length <= EVENTS_PER_PAGE),
					new ButtonBuilder()
						.setCustomId('done')
						.setLabel('Done')
						.setStyle(ButtonStyle.Danger)
				);

				const message = await dmChannel.send({
					embeds: [initialEmbed],
					components: [initialButtons], // Send initial message with embed and buttons
				});
				//collector to handle button interactions
				const collector = message.createMessageComponentCollector({ time: 300000 });//5 minute collector timer
				//handle button interactions
				collector.on('collect', async (btnInteraction) => {
					if (btnInteraction.customId === 'done') {
						collector.stop();//stop collector
						await message.edit({ components: [] });
						await btnInteraction.reply('Collector manually terminated.');//notify user
					} else {
						if (btnInteraction.customId === 'prev') currentPage--;//go to previous page
						if (btnInteraction.customId === 'next') currentPage++;//go to next page
						await updateMessage(currentPage, message);
						await btnInteraction.deferUpdate();
					}
				});
				//remove buttons once the collector ends and when interaction ends
				collector.on('end', async () => {
					await message.edit({ components: [] });
				});
			} catch (err) {
				/* 
				If an error occurs during the interaction or event retrieval,
				log the error and notify the user with a follow-up message.
				*/
				console.error(err);
				await interaction.followUp('Failed to retrieve calendar events.');
			}// Notify the user of failure
		}
		// Authenticate the user and fetch events
		try {
			await interaction.reply('Authenticating and fetching events...');
			const auth = await authorize();
			await listEvents(auth, interaction, className, locationType);
		} catch (err) {
			/* 
			If an error occurs during authentication or initialization, 
			log the error and notify the user with a follow-up message.
			*/
			console.error(err); // Log the error to the console
			await interaction.followUp('An error occurred during authentication or event retrieval.'); // Notify the user		
			}
	}
}