import type { CollectionEntry } from "astro:content";

type EventEntry = CollectionEntry<"events">;
type VenueEntry = CollectionEntry<"venues">;

export type EventWithVenue = EventEntry & {
	venueEntry?: VenueEntry;
};

const eventStatusLabels = {
	fi: {
		cancelled: "Peruttu",
		completed: "Mennyt",
		scheduled: "Tulossa",
	},
	en: {
		cancelled: "Cancelled",
		completed: "Past",
		scheduled: "Upcoming",
	},
} as const;

export function getEventDate(value: Date | string | undefined | null) {
	if (value instanceof Date) return value;
	if (typeof value === "string" && value) return new Date(value);
	return null;
}

export function attachVenues(events: EventEntry[], venues: VenueEntry[]): EventWithVenue[] {
	const venuesById = new Map(venues.map((venue) => [venue.data.id, venue]));
	return events.map((event) => ({
		...event,
		venueEntry: event.data.venue ? venuesById.get(event.data.venue) : undefined,
	}));
}

export function getUpcomingEvents(events: EventWithVenue[], now = new Date()) {
	return events
		.filter((event) => {
			const start = getEventDate(event.data.start_at);
			return (
				event.data.status === "published" &&
				event.data.event_status !== "cancelled" &&
				event.data.hide_from_upcoming !== true &&
				start !== null &&
				start >= now
			);
		})
		.sort((a, b) => (getEventDate(a.data.start_at)?.getTime() ?? 0) - (getEventDate(b.data.start_at)?.getTime() ?? 0));
}

export function getPastEvents(events: EventWithVenue[], now = new Date()) {
	return events
		.filter((event) => {
			const start = getEventDate(event.data.start_at);
			return event.data.status === "published" && start !== null && start < now;
		})
		.sort((a, b) => (getEventDate(b.data.start_at)?.getTime() ?? 0) - (getEventDate(a.data.start_at)?.getTime() ?? 0));
}

export function groupEventsByYear(events: EventWithVenue[]) {
	const groups = new Map<number, EventWithVenue[]>();
	for (const event of events) {
		const start = getEventDate(event.data.start_at);
		if (!start) continue;
		const year = start.getFullYear();
		groups.set(year, [...(groups.get(year) ?? []), event]);
	}
	return [...groups.entries()].sort(([a], [b]) => b - a);
}

export function formatEventDate(date: Date, lang: "fi" | "en") {
	return date.toLocaleDateString(lang === "fi" ? "fi-FI" : "en-GB", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "Europe/Helsinki",
	});
}

export function formatEventTime(date: Date, lang: "fi" | "en") {
	return date.toLocaleTimeString(lang === "fi" ? "fi-FI" : "en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Helsinki",
	});
}

export function formatEventDateTimeRange(event: EventEntry, lang: "fi" | "en") {
	const start = getEventDate(event.data.start_at);
	const end = getEventDate(event.data.end_at);
	if (!start) return "";
	const date = formatEventDate(start, lang);
	const startTime = formatEventTime(start, lang);
	if (!end) return `${date} ${startTime}`;

	const sameDay = start.toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki" }) ===
		end.toLocaleDateString("fi-FI", { timeZone: "Europe/Helsinki" });
	if (sameDay) return `${date} ${startTime}-${formatEventTime(end, lang)}`;

	return `${date} ${startTime} - ${formatEventDate(end, lang)} ${formatEventTime(end, lang)}`;
}

export function getEventStatusLabel(status: string | undefined, lang: "fi" | "en") {
	if (status === "cancelled" || status === "completed" || status === "scheduled") {
		return eventStatusLabels[lang][status];
	}
	return status ?? "";
}
