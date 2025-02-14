export interface Reminder {
	owner: string;
	expires: Date;
	content: string;
	repeat: null | 'daily' | 'weekly';
	mode: 'public' | 'private';
	filterBy?: 'relevance' | 'salary' | 'date' | 'default' | null
}
