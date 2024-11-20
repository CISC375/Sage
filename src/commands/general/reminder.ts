import { ApplicationCommandOptionData, ApplicationCommandType } from 'discord.js';
import schedule from "node-schedule";
import { Command } from '@root/src/lib/types/Command';
import { ChatInputCommandInteraction } from 'discord.js';
import { userEvents } from './calendar';

export default class ReminderCommand extends Command {
  name = "reminder";
  description = "Sets a reminder for an event";
  type = ApplicationCommandType.ChatInput;
  options: ApplicationCommandOptionData[] = [
    {
      name: "event_name",
      description: "The name of the event for which to set a reminder",
      type: 3, // Type 3 corresponds to STRING
      required: true,
    },
    {
      name: "reminder_time",
      description: "How many minutes before the event to set the reminder (e.g., 15m, 30m)",
      type: 3, // Type 3 corresponds to STRING
      required: true,
    },
  ];

  async run(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;

	console.log(userId);

    // Get user's events from the store
    const events = userEvents.get(userId);
    if (!events || events.length === 0) {
      await interaction.reply({
        content: "You have no events fetched. Please use `/calendar` first.",
        ephemeral: true,
      });
      return;
    }

    // Ask the user for the event name
    const eventName = interaction.options.getString("event_name", true);
    const reminderTimeStr = interaction.options.getString("reminder_time", true); // e.g., "15m"
	console.log(`reminderTimeString: ${reminderTimeStr}`);

    // Parse reminder time
    const reminderOffsetMs = this.parseReminderTime(reminderTimeStr);

    // Find the selected event
    const event = events.find((e) => e.summary.toLowerCase() === eventName.toLowerCase());
    if (!event) {
      await interaction.reply({ content: `Event "${eventName}" not found.`, ephemeral: true });
      return;
    }

    // Calculate reminder time
    const eventStart = new Date(event.start.dateTime || event.start.date);
	console.log(`eventStart: ${eventStart}`);

    const reminderTime = new Date(eventStart.getTime() - reminderOffsetMs);
	console.log(`reminderTime: ${reminderTime}`);

    // Schedule the reminder
    this.scheduleReminder(interaction.user.id, event, reminderTime);

    await interaction.reply({
      content: `Reminder set for "${event.summary}" ${reminderTimeStr} before the event.`,
      ephemeral: true,
    });
  }

  // Parse reminder time from string (e.g., "15m", "30m")
  parseReminderTime(timeStr: string): number {
    const units = { m: 60000, h: 3600000 };
    const match = timeStr.match(/^(\d+)([mh])$/);
    if (!match) throw new Error("Invalid time format. Use '15m', '30m', or '1h'.");
    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  // Schedule a reminder
  // Schedule a reminder
scheduleReminder(userId: string, event: any, reminderTime: Date) {
	console.log(`Scheduling reminder for user ${userId} at ${reminderTime}`);
  
	schedule.scheduleJob(reminderTime, async () => {
	  try {
		console.log(`Executing reminder for user ${userId}`);
  
		// Fetch the user object
		const user = await this.client.users.fetch(userId);
  
		if (!user) {
		  console.error(`User with ID ${userId} not found.`);
		  return;
		}
  
		// Format the event start time
		const eventStart = new Date(event.start.dateTime || event.start.date);
		const formattedStart = eventStart.toLocaleString();
  
		// Send the reminder to the user
		await user.send(`Reminder: **${event.summary}** is scheduled for ${formattedStart}.`);
		console.log(`Reminder sent to user ${userId}`);
	  } catch (error) {
		console.error(`Failed to send reminder to user ${userId}:`, error);
	  }
	});
  }
  
}
