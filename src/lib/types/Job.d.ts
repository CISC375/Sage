export interface Job {
	owner: string;
	questionSet: number;
	content: string;
	location: string;
	questionSet: number;
	answers: string[];
	mode: 'public' | 'private';
}
