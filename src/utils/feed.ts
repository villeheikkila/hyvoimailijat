import type { PortableTextBlock } from "emdash";
import { getReadingTime } from "./reading-time";

export type FeedLocale = "fi" | "en";

export interface FeedMetaItem {
	label: string;
	datetime?: string;
}

export function formatFeedDate(
	date: Date | null | undefined,
	locale: FeedLocale,
): string | null {
	if (!date) return null;
	return date.toLocaleDateString(locale === "fi" ? "fi-FI" : "en-GB", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function getPostFeedMeta(
	publishedAt: Date | null | undefined,
	content: PortableTextBlock[] | undefined,
	locale: FeedLocale,
): FeedMetaItem[] {
	const date = formatFeedDate(publishedAt, locale);
	return [
		...(date
			? [{ label: date, datetime: publishedAt?.toISOString() }]
			: []),
		{ label: `${getReadingTime(content)} min` },
	];
}
