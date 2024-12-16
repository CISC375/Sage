/* eslint-disable camelcase */
export interface AdzunaJobResponse {
	company: {
		display_name: string
	};
	title: string,
	description: string,
	location: {
		display_name: string,
		area: string
	}
	created: string;
	salary_max: number | string;
	salary_min: number | string;
	redirect_url: string;
}
