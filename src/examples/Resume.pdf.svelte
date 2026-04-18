<!--
	Resume / CV example template.

	Demonstrates:
	  - Two-column layout (sidebar + main content)
	  - SVG circle avatar with initials
	  - Sidebar with contact info, skills, and education
	  - Main content with professional summary and work experience timeline
	  - Automatic overflow to a second page

	Usage:
	  import { renderComponent } from '../lib/runtime/render.js';
	  import Resume from './Resume.pdf.svelte';
	  const stream = await renderComponent(Resume, resumeData);
-->
<script lang="ts">
	import Page from '../lib/components/Page/Page.svelte';
	import View from '../lib/components/View/View.svelte';
	import Text from '../lib/components/Text/Text.svelte';
	import Svg from '../lib/components/Svg/Svg.svelte';
	import Circle from '../lib/components/Svg/Circle.svelte';
	import Line from '../lib/components/Svg/Line.svelte';
	import SvgText from '../lib/components/Svg/SvgText.svelte';
	import SectionHeading from './shared/SectionHeading.svelte';
	import type { ResumeProps } from './types/resume.js';
	import { RESUME } from './shared/colors.js';

	const {
		name,
		title,
		contact,
		summary,
		experience,
		education,
		skills
	}: ResumeProps = $props();

	// Two-letter initials for the avatar
	const initials = name
		.split(' ')
		.map((w: string) => w[0])
		.slice(0, 2)
		.join('');
</script>

<!--
	No padding on <Page> — each column manages its own padding.
	minHeight: '100%' on the row ensures the sidebar fills the page even when
	content is short.
-->
<Page size="A4">
	<View style={{ flexDirection: 'row', minHeight: '100%' }}>

		<!-- ═══════════════════════════════════════════════════════════════ -->
		<!-- LEFT SIDEBAR                                                     -->
		<!-- ═══════════════════════════════════════════════════════════════ -->
		<View
			style={{
				width: 170,
				backgroundColor: RESUME.sidebarBg,
				padding: 24,
				flexShrink: 0
			}}
		>

			<!-- Avatar -->
			<View style={{ alignItems: 'center', marginBottom: 16 }}>
				<Svg width={80} height={80}>
					<Circle cx={40} cy={40} r={38} fill={RESUME.accent} />
					<SvgText
						x={40}
						y={47}
						text={initials}
						fontSize={24}
						fontFamily="Helvetica-Bold"
						fill={RESUME.sidebarBg}
						textAnchor="middle"
					/>
				</Svg>
			</View>

			<!-- Name + title in sidebar -->
			<Text
				text={name}
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 11,
					color: RESUME.sidebarText,
					textAlign: 'center',
					marginBottom: 2
				}}
			/>
			<Text
				text={title}
				style={{
					fontFamily: 'Helvetica-Oblique',
					fontSize: 8,
					color: RESUME.accent,
					textAlign: 'center',
					marginBottom: 16
				}}
			/>

			<!-- Divider -->
			<View
				style={{ height: 1, backgroundColor: RESUME.divider, marginBottom: 16 }}
			/>

			<!-- CONTACT -->
			<Text
				text="CONTACT"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 7,
					color: RESUME.accent,
					letterSpacing: 1.5,
					marginBottom: 8
				}}
			/>

			<!-- Email -->
			<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
				<View
					style={{
						width: 14,
						height: 14,
						borderRadius: 2,
						backgroundColor: RESUME.accent,
						justifyContent: 'center',
						alignItems: 'center',
						marginRight: 6,
						flexShrink: 0
					}}
				>
					<Text
						text="@"
						style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: RESUME.sidebarBg }}
					/>
				</View>
				<Text
					text={contact.email}
					style={{ fontSize: 8, color: '#cbd5e1', flexGrow: 1 }}
				/>
			</View>

			{#if contact.phone}
				<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
					<View
						style={{
							width: 14,
							height: 14,
							borderRadius: 2,
							backgroundColor: RESUME.accent,
							justifyContent: 'center',
							alignItems: 'center',
							marginRight: 6,
							flexShrink: 0
						}}
					>
						<Text
							text="T"
							style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: RESUME.sidebarBg }}
						/>
					</View>
					<Text
						text={contact.phone}
						style={{ fontSize: 8, color: '#cbd5e1', flexGrow: 1 }}
					/>
				</View>
			{/if}

			<!-- Location -->
			<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
				<View
					style={{
						width: 14,
						height: 14,
						borderRadius: 2,
						backgroundColor: RESUME.accent,
						justifyContent: 'center',
						alignItems: 'center',
						marginRight: 6,
						flexShrink: 0
					}}
				>
					<Text
						text="L"
						style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: RESUME.sidebarBg }}
					/>
				</View>
				<Text
					text={contact.location}
					style={{ fontSize: 8, color: '#cbd5e1', flexGrow: 1 }}
				/>
			</View>

			{#if contact.linkedin}
				<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
					<View
						style={{
							width: 14,
							height: 14,
							borderRadius: 2,
							backgroundColor: RESUME.accent,
							justifyContent: 'center',
							alignItems: 'center',
							marginRight: 6,
							flexShrink: 0
						}}
					>
						<Text
							text="in"
							style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: RESUME.sidebarBg }}
						/>
					</View>
					<Text
						text={contact.linkedin}
						style={{ fontSize: 8, color: '#cbd5e1', flexGrow: 1 }}
					/>
				</View>
			{/if}

			{#if contact.github}
				<View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 }}>
					<View
						style={{
							width: 14,
							height: 14,
							borderRadius: 2,
							backgroundColor: RESUME.accent,
							justifyContent: 'center',
							alignItems: 'center',
							marginRight: 6,
							flexShrink: 0
						}}
					>
						<Text
							text="GH"
							style={{ fontFamily: 'Helvetica-Bold', fontSize: 6, color: RESUME.sidebarBg }}
						/>
					</View>
					<Text
						text={contact.github}
						style={{ fontSize: 8, color: '#cbd5e1', flexGrow: 1 }}
					/>
				</View>
			{/if}

			<!-- Divider -->
			<View
				style={{ height: 1, backgroundColor: RESUME.divider, marginTop: 12, marginBottom: 16 }}
			/>

			<!-- SKILLS -->
			<Text
				text="SKILLS"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 7,
					color: RESUME.accent,
					letterSpacing: 1.5,
					marginBottom: 8
				}}
			/>

			{#each skills as group}
				<Text
					text={group.category}
					style={{
						fontFamily: 'Helvetica-Bold',
						fontSize: 8,
						color: RESUME.sidebarText,
						marginBottom: 4
					}}
				/>
				{#each group.skills as skill}
					<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
						<View
							style={{
								width: 4,
								height: 4,
								borderRadius: 2,
								backgroundColor: RESUME.accent,
								marginRight: 6,
								flexShrink: 0
							}}
						/>
						<Text text={skill} style={{ fontSize: 8, color: '#cbd5e1' }} />
					</View>
				{/each}
				<View style={{ marginBottom: 6 }} />
			{/each}

			<!-- Divider -->
			<View
				style={{ height: 1, backgroundColor: RESUME.divider, marginTop: 4, marginBottom: 16 }}
			/>

			<!-- EDUCATION -->
			<Text
				text="EDUCATION"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 7,
					color: RESUME.accent,
					letterSpacing: 1.5,
					marginBottom: 8
				}}
			/>

			{#each education as edu}
				<Text
					text={edu.degree}
					style={{
						fontFamily: 'Helvetica-Bold',
						fontSize: 8,
						color: RESUME.sidebarText,
						marginBottom: 2
					}}
				/>
				<Text
					text={edu.institution}
					style={{ fontSize: 8, color: '#cbd5e1' }}
				/>
				<Text
					text={edu.year}
					style={{
						fontSize: 8,
						color: RESUME.accent,
						marginBottom: 10
					}}
				/>
			{/each}
		</View>

		<!-- ═══════════════════════════════════════════════════════════════ -->
		<!-- RIGHT MAIN CONTENT                                              -->
		<!-- ═══════════════════════════════════════════════════════════════ -->
		<View
			style={{
				flexGrow: 1,
				padding: 30,
				backgroundColor: '#ffffff'
			}}
		>

			<!-- Name heading -->
			<Text
				text={name}
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 22,
					color: RESUME.text,
					marginBottom: 2
				}}
			/>
			<Text
				text={title}
				style={{
					fontFamily: 'Helvetica',
					fontSize: 11,
					color: RESUME.accentDark,
					marginBottom: 6
				}}
			/>

			<!-- Accent bar under name -->
			<View
				style={{
					height: 3,
					width: 50,
					backgroundColor: RESUME.accentDark,
					borderRadius: 2,
					marginBottom: 20
				}}
			/>

			<!-- PROFESSIONAL SUMMARY -->
			<SectionHeading text="PROFESSIONAL SUMMARY" color={RESUME.accentDark} />
			<Text
				text={summary}
				style={{
					fontFamily: 'Helvetica',
					fontSize: 9,
					color: RESUME.muted,
					lineHeight: 1.6,
					marginBottom: 20
				}}
			/>

			<!-- WORK EXPERIENCE -->
			<SectionHeading text="WORK EXPERIENCE" color={RESUME.accentDark} />

			{#each experience as job}
				<View style={{ flexDirection: 'row', marginBottom: 16 }}>

					<!-- Timeline column: dot + vertical line -->
					<View style={{ width: 20, alignItems: 'center', flexShrink: 0 }}>
						<Svg width={20} height={300}>
							<Circle cx={10} cy={8} r={5} fill={RESUME.accentDark} />
							<!--
								Line height set to 300pt — PDFKit clips to the SVG layout box
								so any excess is invisible.
							-->
							<Line
								x1={10}
								y1={13}
								x2={10}
								y2={300}
								stroke={RESUME.accentDark}
								strokeWidth={1}
								opacity={0.25}
							/>
						</Svg>
					</View>

					<!-- Job details -->
					<View style={{ flexGrow: 1, paddingLeft: 8 }}>
						<Text
							text={job.role}
							style={{
								fontFamily: 'Helvetica-Bold',
								fontSize: 10,
								color: RESUME.text,
								marginBottom: 2
							}}
						/>
						<View
							style={{
								flexDirection: 'row',
								justifyContent: 'space-between',
								marginBottom: 6
							}}
						>
							<Text
								text={job.company}
								style={{ fontFamily: 'Helvetica', fontSize: 9, color: RESUME.accentDark }}
							/>
							<Text
								text={job.period}
								style={{
									fontFamily: 'Helvetica-Oblique',
									fontSize: 8,
									color: RESUME.muted
								}}
							/>
						</View>

						{#each job.bullets as bullet}
							<View style={{ flexDirection: 'row', marginBottom: 3 }}>
								<Text
									text="•"
									style={{
										fontFamily: 'Helvetica-Bold',
										fontSize: 9,
										color: RESUME.accentDark,
										width: 10,
										flexShrink: 0
									}}
								/>
								<Text
									text={bullet}
									style={{
										fontFamily: 'Helvetica',
										fontSize: 9,
										color: RESUME.muted,
										flexGrow: 1,
										lineHeight: 1.4
									}}
								/>
							</View>
						{/each}
					</View>
				</View>
			{/each}
		</View>

	</View>
</Page>
