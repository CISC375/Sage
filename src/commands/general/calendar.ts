import { ChatInputCommandInteraction, InteractionResponse } from "discord.js";
import { Command } from "@lib/types/Command";
const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

export default class extends Command {
	name = "calendar";
	description = "Retrieves calendar events";

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<InteractionResponse<boolean> | void> {
		// If modifying these scopes, delete token.json.
		const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
		// The file token.json stores the user's access and refresh tokens, and is
		// created automatically when the authorization flow completes for the first
		// time.
		const TOKEN_PATH = path.join(process.cwd(), "token.json");
		const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

		// function that takes in the even object and prints it into a readable format
		const printEvent = (event) => {
			try {
				// Extracting information from the event object
				const startDateTime = new Date(event.start.dateTime || event.start.date);
				const endDateTime = new Date(event.end.dateTime || event.end.date);
		
				// Formatting date and time
				const startDate = startDateTime.toLocaleDateString();
				const endDate = endDateTime.toLocaleDateString();
				const startTime = startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
				const endTime = endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		
				// Parse the summary
				const summaryParts = (event.summary || "No Title").split('-');
				const className = summaryParts[0] || "No Class Name";
				const eventHolder = summaryParts[1] || "No Event Holder";
				const eventLocation = summaryParts[2] || "No Location"; //virtual/in-person
		
				// Alternatively, use the location from the event object if it exists
				const location = eventLocation;
		
				// Format output
				console.log(`
					${className}
					${eventHolder}
					${startDate}
					${startTime} - ${endTime}
					${event.location}
					${location}
					------------------------------------
				`); 
		//event location - room # or zoom link
				return `
					${className}
					${eventHolder}
					${startDate}
					${startTime} - ${endTime}
					${event.location}
					${location}
					------------------------------------
				`;
			} catch (error) {
				console.error("Error printing event:", error);
				return "Error printing event details.";
			}
		};
		/**
		 * Reads previously authorized credentials from the save file.
		 *
		 * @return {Promise<OAuth2Client|null>}
		 */
		async function loadSavedCredentialsIfExist() {
			try {
				const content = await fs.readFile(TOKEN_PATH);
				const credentials = JSON.parse(content);
				return google.auth.fromJSON(credentials);
			} catch (err) {
				return null;
			}
		}

		/**
		 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
		 *
		 * @param {OAuth2Client} client
		 * @return {Promise<void>}
		 */
		async function saveCredentials(client) {
			const content = await fs.readFile(CREDENTIALS_PATH);
			const keys = JSON.parse(content);
			const key = keys.installed || keys.web;
			const payload = JSON.stringify({
				type: "authorized_user",
				client_id: key.client_id,
				client_secret: key.client_secret,
				refresh_token: client.credentials.refresh_token,
			});
			await fs.writeFile(TOKEN_PATH, payload);
		}

		/**
		 * Load or request or authorization to call APIs.
		 *
		 */
		async function authorize() {
			let client = await loadSavedCredentialsIfExist();
			if (client) {
				return client;
			}
			client = await authenticate({
				scopes: SCOPES,
				keyfilePath: CREDENTIALS_PATH,
			});
			if (client.credentials) {
				await saveCredentials(client);
			}
			return client;
		}

		/**
		 * Lists the next 10 events on the user's primary calendar.
		 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
		 */
		async function listEvents(auth, interaction) {
			const calendar = google.calendar({ version: "v3", auth });
			const res = await calendar.events.list({
				calendarId: "primary",
				timeMin: new Date().toISOString(),
				maxResults: 10,
				singleEvents: true,
				orderBy: "startTime",
			});

			const events = res.data.items;
			if (!events || events.length === 0) {
				await interaction.followUp("No upcoming events found.");
				return;
			}

			const eventList = events
				.map((event, i) => {
					const start = event.start.dateTime || event.start.date;
					return `${printEvent(event)}`;
				})
				.join("");

			await interaction.followUp(`Upcoming 10 events:\n${eventList}`);
		}

		await interaction.reply("Authenticating and fetching events...");

		authorize()
			.then((auth) => listEvents(auth, interaction))
			.catch((error) => {
				console.error(error);
				interaction.followUp("Failed to retrieve events.");
			});
	}
}