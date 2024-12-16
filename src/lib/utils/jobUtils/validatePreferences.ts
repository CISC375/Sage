interface ValidateResult {
	isValid: boolean;
	errors: string[];
}
// Validates the answers inputted by the user based on the question and if it is part of jobForm or update_preferences.
export const validatePreferences = (answers: string[], qset: number, isJobForm: boolean): ValidateResult => {
	const errors: string[] = [];

	// For job form, enforce all fields.
	if (qset === 0) {
		const [city, workType, employmentType, travelDistance] = answers;

		// Only validate non-empty fields when updating preferences.
		if (!isJobForm || city?.trim()) {
			if (city?.trim() === '') {
				errors.push('Enter valid city');
			}
		}
		// Fields must be exact or an error will occur for work types.
		if (!isJobForm || workType?.trim()) {
			const validWorkTypes = [
				'remote', 'hybrid', 'in person',
				'remote, hybrid', 'remote, in person', 'hybrid, in person',
				'hybrid. remote', 'in person, remote', 'in person, hybrid',
				'all'
			];

			if (workType?.trim()) {
				// eslint-disable-next-line id-length
				const workTypes = workType.toLowerCase().split(',').map(t => t.trim());
				// eslint-disable-next-line id-length
				const invalidTypes = workTypes.filter(t => !validWorkTypes.includes(t));

				if (invalidTypes.length > 0) {
					errors.push(`Invalid work type: ${invalidTypes.join(', ')}. Must be remote, hybrid, and/or in person separated only by commas. Must be all if it is all three`);
				}
			} else if (isJobForm) {
				errors.push('Enter valid work type');
			}
		}
		// Fields must be exact or an error will occur for employment type.
		if (!isJobForm || employmentType?.trim()) {
			const validEmploymentTypes = [
				'full time', 'part time', 'internship',
				'full time, part time', 'full time, internship', 'part time, internship',
				'part time, full time', 'internship, full time', 'internship, part time',
				'all'
			];

			if (employmentType?.trim()) {
				// eslint-disable-next-line id-length
				const employmentTypes = employmentType.toLowerCase().split(',').map(t => t.trim());
				// eslint-disable-next-line id-length
				const invalidTypes = employmentTypes.filter(t => !validEmploymentTypes.includes(t));

				if (invalidTypes.length > 0) {
					errors.push(`Invalid employment type: ${invalidTypes.join(', ')}. Must be full time, part time, and/or internship separated only by commas. Must be all if it is all three`);
				}
			} else if (isJobForm) {
				errors.push('Enter valid employment type');
			}
		}
		// Field must be an integer for travel distance or an error will occur.
		if (travelDistance?.trim() && isNaN(Number(travelDistance.replace(/[^0-9]/g, '')))) {
			errors.push('Travel distance must be a number');
		}
	}
	return {
		isValid: errors.length === 0,
		errors
	};
};
