import type { PortableTextBlock } from "emdash";

export type Locale = "fi" | "en";

export interface ClubPageCopy {
	title: string;
	kicker: string;
	description: string;
	cmsSlug: string;
	steps?: string[];
	highlights?: Array<{ label: string; value: string }>;
}

export const pageCopies: Record<string, Record<Locale, ClubPageCopy>> = {
	about: {
		fi: {
			title: "Seura",
			kicker: "Helsingin Yliopiston Voimailijat",
			description:
				"HYV on vuonna 2010 perustettu helsinkilainen opiskelijoiden voimailuseura.",
			cmsSlug: "seura",
			highlights: [
				{ label: "Perustettu", value: "17.3.2010" },
				{ label: "Jäsenmaksu", value: "10 euroa / vuosi" },
				{ label: "Lajiliitto", value: "Suomen Voimanostoliitto" },
			],
		},
		en: {
			title: "About",
			kicker: "Helsingin Yliopiston Voimailijat",
			description:
				"HYV is a Helsinki-based student strength sports club founded in 2010.",
			cmsSlug: "about",
			highlights: [
				{ label: "Founded", value: "17 March 2010" },
				{ label: "Membership", value: "10 euros / year" },
				{ label: "Federation", value: "Finnish Powerlifting Federation" },
			],
		},
	},
	join: {
		fi: {
			title: "Liity jäseneksi",
			kicker: "Jäsenhakemus",
			description:
				"Täytä hakemus. Hallitus käsittelee sen ja lähettää maksuohjeet sähköpostilla.",
			cmsSlug: "liity-jaseneksi",
			steps: [
				"Täytä lomake ja lähetä hakemus.",
				"Jos hallitus hyväksyy hakemuksen, saat maksuohjeet sähköpostilla.",
				"Kun maksu näkyy tilillä, saat ohjeet Nimenhuutoon.",
				"Tervetuloa HYV:n jäseneksi.",
			],
		},
		en: {
			title: "Become a member",
			kicker: "Membership application",
			description:
				"Send an application. The board reviews it and sends payment instructions by email.",
			cmsSlug: "become-a-member",
			steps: [
				"Fill in and submit the application.",
				"If the board accepts it, you will receive payment instructions by email.",
				"When the payment is visible, you will receive Nimenhuuto instructions.",
				"Welcome to HYV.",
			],
		},
	},
	rules: {
		fi: {
			title: "HYV Voimaliiga säännöt",
			kicker: "Kilpailusarja",
			description:
				"Voimaliiga on seitsemän kilpailun kausi HYV:n jäsenille. Kilpailuihin ilmoittaudutaan Nimenhuudossa.",
			cmsSlug: "hyv-voimaliiga-saannot",
		},
		en: {
			title: "HYV Voimaliiga rules",
			kicker: "Competition series",
			description:
				"Voimaliiga is a seven-competition season for HYV members. Registration is handled in Nimenhuuto.",
			cmsSlug: "rules",
		},
	},
	ranking: {
		fi: {
			title: "Ranking",
			kicker: "Seuran ennätykset",
			description:
				"Ranking-listat kokoavat seuran parhaat yhteistulokset ja IPF-pisteet.",
			cmsSlug: "ranking",
		},
		en: {
			title: "Ranking",
			kicker: "Club rankings",
			description:
				"Ranking tables collect the club's best totals and IPF points.",
			cmsSlug: "ranking-en",
		},
	},
};

export function getPlainText(blocks: PortableTextBlock[] | undefined): string {
	if (!Array.isArray(blocks)) return "";

	return blocks
		.map((block) => {
			const children = (block as { children?: Array<{ text?: string }> }).children;
			if (!Array.isArray(children)) return "";
			return children.map((child) => child.text ?? "").join("");
		})
		.filter(Boolean)
		.join("\n");
}

export function parseTableFromPortableText(
	blocks: PortableTextBlock[] | undefined
): string[][] {
	const text = getPlainText(blocks).trim();
	if (!text.startsWith("[[")) return [];

	try {
		const parsed = JSON.parse(text);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((row): row is unknown[] => Array.isArray(row))
			.map((row) => row.map((cell) => String(cell ?? "").trim()));
	} catch {
		return [];
	}
}
