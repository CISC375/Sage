import axios from 'axios';
import { APP_ID, APP_KEY } from '@root/config';
import { JobData } from '../../types/JobData';
import { Interest } from '../../types/Interest';
import { JobListing } from '../../types/JobListing';
import { JobResult } from '../../types/JobResult';
import { AdzunaJobResponse } from '../../types/AdzunaJobResponse';

type JobCache = {
	[key: string]: JobListing[] | JobResult[];
};

const jobCache: JobCache = {};

export default async function fetchJobListings(jobData: JobData, interests?: Interest): Promise<JobResult[]> {
	const LOCATION = encodeURIComponent(jobData.city);
	const JOB_TYPE = encodeURIComponent(jobData.jobType);
	const DISTANCE_KM = Number(jobData.distance) * 1.609; // Convert miles to kilometers

	let whatInterests = '';
	if (interests) {
		const keys = Object.keys(interests);
		const lastKey = keys[keys.length - 1];
		const lastValue = interests[lastKey];

		for (const interest in interests) {
			whatInterests += interests[interest].replace(/\s+/g, '-'); // Replace spaces with dashes
			if (interests[interest] !== lastValue) {
				whatInterests += ' ';
			}
		}
	}
	whatInterests = encodeURIComponent(whatInterests);

	const cacheKey = `${jobData.jobType.toLowerCase()}-${jobData.city.toLowerCase()}-${whatInterests}`;
	if (jobCache[cacheKey]) {
		console.log('Fetching data from cache...');
		return jobCache[cacheKey] as JobResult[];
	}

	// const URL = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=15&what=${JOB_TYPE}&what_or=${whatInterests}&where=
	// ${LOCATION}&distance=${Math.round(DISTANCE_KM)}&sort_by=${jobData.filterBy}`;

	const URL_BASE = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=15&what=${JOB_TYPE}&what_or=${whatInterests}&where=\
	${LOCATION}&distance=${Math.round(DISTANCE_KM)}`;

	try {
		const response = await axios.get(jobData.filterBy && jobData.filterBy !== 'default' ? `${URL_BASE}&sort_by=${jobData.filterBy}` : URL_BASE);
		const jobResults: JobResult[] = response.data.results.map((job: AdzunaJobResponse) => ({
			company: job.company?.display_name || 'Not Provided',
			title: job.title,
			description: job.description || 'No description available',
			location: `${job.location?.display_name || 'Not Provided'} (${job.location?.area?.toString().replace(/,/g, ', ') || ''})`,
			created: job.created || 'Unknown',
			salaryMax: job.salary_max || 'Not listed',
			salaryMin: job.salary_min || 'Not listed',
			link: job.redirect_url || 'No link available'
		}));

		jobCache[cacheKey] = jobResults;

		return jobResults.sort();
	} catch (error) {
		console.error('API error:', error);
		throw error;
	}
}
