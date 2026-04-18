export interface ContactInfo {
	email: string;
	phone?: string;
	location: string;
	linkedin?: string;
	github?: string;
	website?: string;
}

export interface ExperienceEntry {
	company: string;
	role: string;
	period: string;
	location?: string;
	bullets: string[];
}

export interface EducationEntry {
	institution: string;
	degree: string;
	year: string;
	gpa?: string;
}

export interface SkillGroup {
	category: string;
	skills: string[];
}

export interface ResumeProps {
	name: string;
	title: string;
	contact: ContactInfo;
	summary: string;
	experience: ExperienceEntry[];
	education: EducationEntry[];
	skills: SkillGroup[];
}
