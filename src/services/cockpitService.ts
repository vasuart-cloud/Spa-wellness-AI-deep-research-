import {
  AIAssistSuggestion,
  CustomerInteraction,
  GuestAppointment,
} from "../types/domain";
import { SALONS } from "./syntheticDataService";

export const CALENDAR_WEEK_DATES: Array<{
  date: string;
  dayShort: string;
  dayNum: string;
  monthShort: string;
  isToday?: boolean;
}> = [
  { date: "2026-10-23", dayShort: "Fri", dayNum: "23", monthShort: "Oct" },
  { date: "2026-10-24", dayShort: "Sat", dayNum: "24", monthShort: "Oct" },
  {
    date: "2026-10-25",
    dayShort: "Sun",
    dayNum: "25",
    monthShort: "Oct",
    isToday: true,
  },
  { date: "2026-10-26", dayShort: "Mon", dayNum: "26", monthShort: "Oct" },
  { date: "2026-10-27", dayShort: "Tue", dayNum: "27", monthShort: "Oct" },
  { date: "2026-10-28", dayShort: "Wed", dayNum: "28", monthShort: "Oct" },
  { date: "2026-10-29", dayShort: "Thu", dayNum: "29", monthShort: "Oct" },
];

export const BOOKING_TIME_SLOTS: string[] = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
];

export const STYLISTS_BY_SALON: Record<string, string[]> = {
  "SLN-PNW-01": [
    "Sienna Mercer (Master Colorist)",
    "Liam Kensington (Senior Stylist)",
    "Chloe Takahashi (Keratin Specialist)",
    "Nora Lindstrom (Esthetician Lead)",
  ],
  "SLN-PNW-02": [
    "Gabriel Hayes (Creative Director)",
    "Zoe Callahan (Master Balayage)",
    "Ruby Sato (Senior Stylist)",
  ],
  "SLN-PNW-03": [
    "Avery Kwon (Master Stylist)",
    "Mila Novak (Scalp & Spa Lead)",
    "Ethan Ross (Color Specialist)",
  ],
  "SLN-PNW-04": [
    "Clara Bennett (Spa Director)",
    "Lucas Park (Senior Stylist)",
    "Harper Lin (Colorist)",
  ],
  "SLN-PNW-05": [
    "Jade Morales (Texture Specialist)",
    "Owen Sullivan (Senior Stylist)",
    "Aria Chen (Esthetician)",
  ],
  "SLN-SW-01": [
    "Valentina Cruz (Master Colorist)",
    "Mateo Silva (Editorial Stylist)",
    "Savannah Cole (Wellness Lead)",
  ],
  "SLN-SW-02": [
    "Riley Dawson (Senior Colorist)",
    "Caleb Brooks (Master Cutter)",
  ],
  "SLN-MW-01": [
    "Freya Lindholm (Master Stylist)",
    "Sebastian Grant (Color Director)",
  ],
  "SLN-NE-01": [
    "Celeste Moreau (Couture Colorist)",
    "Theo Sterling (Artistic Director)",
  ],
};

export function getStylistsForSalon(salonId: string): string[] {
  if (STYLISTS_BY_SALON[salonId]) {
    return STYLISTS_BY_SALON[salonId];
  }
  const salon = SALONS.find((s) => s.id === salonId);
  const lead = salon ? salon.managerName : "Studio Lead";
  return [
    `${lead} (Master Stylist)`,
    "Taylor Reed (Senior Colorist)",
    "Morgan Ellis (Spa & Scalp Specialist)",
  ];
}

export function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${m} ${suffix}`;
}

export function createInitialAppointments(): GuestAppointment[] {
  return [
    // TODAY: Sunday 2026-10-25 (Rich PNW + Multi-Region Schedule)
    {
      id: "APT-401",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Olivia Hawthorne",
      guestPhone: "(425) 555-0148",
      membershipTier: "VIP Wellness",
      serviceName: "Dimensional Balayage & Gloss Bond",
      category: "Hair Color & Balayage",
      stylistName: "Sienna Mercer (Master Colorist)",
      chairLabel: "Chair 02",
      date: "2026-10-25",
      startTime: "10:30",
      durationMin: 150,
      priceUsd: 325,
      status: "Confirmed",
      linkedInteractionId: "INT-901",
      interactionSummary:
        "Live Chat: Flight into SEA-TAC delayed; requesting move to Mon Oct 26 at 11:00 AM & asking to waive $65 late-move fee.",
      updatedAt: "2026-10-25 09:42",
    },
    {
      id: "APT-402",
      salonId: "SLN-PNW-02",
      salonName: "Capitol Hill Atelier",
      region: "Pacific Northwest",
      guestName: "Rachel Donovan",
      guestPhone: "(206) 555-0193",
      membershipTier: "Signature Member",
      serviceName: "Full Highlight & Root Melt",
      category: "Hair Color & Balayage",
      stylistName: "Zoe Callahan (Master Balayage)",
      chairLabel: "Chair 04",
      date: "2026-10-25",
      startTime: "11:30",
      durationMin: 120,
      priceUsd: 310,
      status: "Confirmed",
      linkedInteractionId: "INT-902",
      interactionSummary:
        "Live Voice Call: Guest states last week's highlight pulled warm/brassy; asking for immediate refund or complimentary toner fix today.",
      updatedAt: "2026-10-25 09:48",
    },
    {
      id: "APT-403",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Samantha Lin",
      guestPhone: "(425) 555-0172",
      membershipTier: "VIP Wellness",
      serviceName: "Botanical Amino Keratin Express",
      category: "Keratin & Smoothing",
      stylistName: "Chloe Takahashi (Keratin Specialist)",
      chairLabel: "Chair 06",
      date: "2026-10-25",
      startTime: "14:00",
      durationMin: 90,
      priceUsd: 265,
      status: "Confirmed",
      linkedInteractionId: "INT-903",
      interactionSummary:
        "Live Chat: Second-trimester pregnancy ingredient question; may switch to Organic Hydro-Scalp Ritual or cancel if aldehydes present.",
      updatedAt: "2026-10-25 09:50",
    },
    {
      id: "APT-404",
      salonId: "SLN-PNW-03",
      salonName: "Pearl District Sanctuary",
      region: "Pacific Northwest",
      guestName: "Daniela Vega",
      guestPhone: "(503) 555-0164",
      membershipTier: "Signature Member",
      serviceName: "Japanese Head Spa & Hydro-Facial",
      category: "Scalp & Wellness",
      stylistName: "Mila Novak (Scalp & Spa Lead)",
      chairLabel: "Suite 01",
      date: "2026-10-25",
      startTime: "13:00",
      durationMin: 90,
      priceUsd: 215,
      status: "Confirmed",
      linkedInteractionId: "INT-904",
      interactionSummary:
        "Live Voice Call: Childcare conflict at 1:00 PM; asking to reschedule to Tue Oct 27 afternoon or cancel without losing package credit.",
      updatedAt: "2026-10-25 09:51",
    },
    {
      id: "APT-405",
      salonId: "SLN-PNW-04",
      salonName: "Kirkland Waterfront Spa",
      region: "Pacific Northwest",
      guestName: "Victoria Kingsley",
      guestPhone: "(425) 555-0119",
      membershipTier: "VIP Wellness",
      serviceName: "Cellular Renewal Peptide Facial",
      category: "Spa & Facial",
      stylistName: "Clara Bennett (Spa Director)",
      chairLabel: "Spa Room 03",
      date: "2026-10-25",
      startTime: "09:30",
      durationMin: 75,
      priceUsd: 195,
      status: "Checked In",
      linkedInteractionId: "INT-906",
      interactionSummary:
        "Previous Chat: Applied transferred Scottsdale VIP credit at check-in.",
      updatedAt: "2026-10-25 09:20",
    },
    {
      id: "APT-406",
      salonId: "SLN-PNW-05",
      salonName: "Fremont Urban Lounge",
      region: "Pacific Northwest",
      guestName: "Marcus Bell",
      guestPhone: "(206) 555-0181",
      membershipTier: "Standard Guest",
      serviceName: "Precision Texture Cut & Scalp Detox",
      category: "Cut & Styling",
      stylistName: "Jade Morales (Texture Specialist)",
      chairLabel: "Chair 01",
      date: "2026-10-25",
      startTime: "15:30",
      durationMin: 60,
      priceUsd: 125,
      status: "Confirmed",
      updatedAt: "2026-10-24 18:10",
    },
    {
      id: "APT-407",
      salonId: "SLN-PNW-02",
      salonName: "Capitol Hill Atelier",
      region: "Pacific Northwest",
      guestName: "Natalie Brooks",
      guestPhone: "(206) 555-0137",
      membershipTier: "Signature Member",
      serviceName: "Couture Blowout & Bond Masque",
      category: "Cut & Styling",
      stylistName: "Gabriel Hayes (Creative Director)",
      chairLabel: "Chair 01",
      date: "2026-10-25",
      startTime: "16:30",
      durationMin: 60,
      priceUsd: 110,
      status: "Confirmed",
      updatedAt: "2026-10-24 19:00",
    },
    {
      id: "APT-408",
      salonId: "SLN-SW-01",
      salonName: "Scottsdale Kierland Retreat",
      region: "Southwest",
      guestName: "Genevieve Sterling",
      guestPhone: "(480) 555-0126",
      membershipTier: "VIP Wellness",
      serviceName: "Desert Botanical Body Polish & Facial",
      category: "Spa & Facial",
      stylistName: "Savannah Cole (Wellness Lead)",
      chairLabel: "Suite 04",
      date: "2026-10-25",
      startTime: "11:00",
      durationMin: 120,
      priceUsd: 290,
      status: "Confirmed",
      linkedInteractionId: "INT-905",
      interactionSummary:
        "Live Chat (Southwest): Asking about retinol peel downtime before outdoor gala & post-care kit pricing.",
      updatedAt: "2026-10-25 09:45",
    },
    {
      id: "APT-409",
      salonId: "SLN-NE-01",
      salonName: "SoHo Mercer Loft",
      region: "Northeast",
      guestName: "claire Montgomery".replace(/^c/, "C"),
      guestPhone: "(212) 555-0198",
      membershipTier: "VIP Wellness",
      serviceName: "Editorial Blonde & Olaplex Rebuild",
      category: "Hair Color & Balayage",
      stylistName: "Celeste Moreau (Couture Colorist)",
      chairLabel: "Chair 03",
      date: "2026-10-25",
      startTime: "13:30",
      durationMin: 150,
      priceUsd: 385,
      status: "Confirmed",
      updatedAt: "2026-10-24 20:15",
    },

    // YESTERDAY: Saturday 2026-10-24 & Friday 2026-10-23 (Completed / Previous Interactions)
    {
      id: "APT-395",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Grace Callahan",
      guestPhone: "(425) 555-0155",
      membershipTier: "Signature Member",
      serviceName: "Lived-In Brunette & Precision Cut",
      category: "Hair Color & Balayage",
      stylistName: "Liam Kensington (Senior Stylist)",
      chairLabel: "Chair 03",
      date: "2026-10-24",
      startTime: "11:00",
      durationMin: 135,
      priceUsd: 285,
      status: "Completed",
      linkedInteractionId: "INT-907",
      interactionSummary:
        "Previous Voice Transcript: Confirmed PPD-free ammonia-free gloss formula prior to service.",
      updatedAt: "2026-10-24 13:20",
    },
    {
      id: "APT-396",
      salonId: "SLN-PNW-03",
      salonName: "Pearl District Sanctuary",
      region: "Pacific Northwest",
      guestName: "Julianna Reeves",
      guestPhone: "(503) 555-0122",
      membershipTier: "Standard Guest",
      serviceName: "Signature Cut & Botanical Gloss",
      category: "Cut & Styling",
      stylistName: "Avery Kwon (Master Stylist)",
      chairLabel: "Chair 02",
      date: "2026-10-24",
      startTime: "14:30",
      durationMin: 75,
      priceUsd: 155,
      status: "Rescheduled",
      linkedInteractionId: "INT-908",
      interactionSummary:
        "Previous Voice Transcript: Moved to Mon Oct 26 at 14:00 due to I-5 bridge closure.",
      lastActionNote: "Rescheduled from Oct 24 14:30 · Courtesy traffic waiver",
      feeWaived: true,
      updatedAt: "2026-10-24 12:10",
    },
    {
      id: "APT-397",
      salonId: "SLN-PNW-05",
      salonName: "Fremont Urban Lounge",
      region: "Pacific Northwest",
      guestName: "Trevor Whitaker",
      guestPhone: "(206) 555-0141",
      membershipTier: "Standard Guest",
      serviceName: "Detox Clay Scalp Therapy",
      category: "Scalp & Wellness",
      stylistName: "Owen Sullivan (Senior Stylist)",
      chairLabel: "Chair 04",
      date: "2026-10-23",
      startTime: "16:00",
      durationMin: 60,
      priceUsd: 135,
      status: "Completed",
      updatedAt: "2026-10-23 17:05",
    },

    // UPCOMING WEEK: Mon Oct 26 – Thu Oct 29, 2026
    {
      id: "APT-410",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Lauren Pembroke",
      guestPhone: "(425) 555-0188",
      membershipTier: "VIP Wellness",
      serviceName: "Bridal Trial Updo & Champagne Facial",
      category: "Spa & Facial",
      stylistName: "Nora Lindstrom (Esthetician Lead)",
      chairLabel: "Bridal Suite",
      date: "2026-10-26",
      startTime: "10:00",
      durationMin: 120,
      priceUsd: 340,
      status: "Confirmed",
      linkedInteractionId: "INT-909",
      interactionSummary:
        "Previous Chat: Requested adding sister's blowout side-by-side at 10:30 AM.",
      updatedAt: "2026-10-24 16:40",
    },
    {
      id: "APT-411",
      salonId: "SLN-PNW-03",
      salonName: "Pearl District Sanctuary",
      region: "Pacific Northwest",
      guestName: "Julianna Reeves",
      guestPhone: "(503) 555-0122",
      membershipTier: "Standard Guest",
      serviceName: "Signature Cut & Botanical Gloss",
      category: "Cut & Styling",
      stylistName: "Avery Kwon (Master Stylist)",
      chairLabel: "Chair 02",
      date: "2026-10-26",
      startTime: "14:00",
      durationMin: 75,
      priceUsd: 155,
      status: "Confirmed",
      linkedInteractionId: "INT-908",
      lastActionNote: "Moved from Sat Oct 24 14:30 per Voice Call INT-908",
      updatedAt: "2026-10-24 12:10",
    },
    {
      id: "APT-412",
      salonId: "SLN-PNW-02",
      salonName: "Capitol Hill Atelier",
      region: "Pacific Northwest",
      guestName: "Simone Devereaux",
      guestPhone: "(206) 555-0169",
      membershipTier: "VIP Wellness",
      serviceName: "Platinum Seamless Root Touch-Up",
      category: "Hair Color & Balayage",
      stylistName: "Zoe Callahan (Master Balayage)",
      chairLabel: "Chair 04",
      date: "2026-10-27",
      startTime: "11:00",
      durationMin: 120,
      priceUsd: 275,
      status: "Confirmed",
      updatedAt: "2026-10-24 15:00",
    },
    {
      id: "APT-413",
      salonId: "SLN-PNW-04",
      salonName: "Kirkland Waterfront Spa",
      region: "Pacific Northwest",
      guestName: "elliott Vance".replace(/^e/, "E"),
      guestPhone: "(425) 555-0131",
      membershipTier: "Signature Member",
      serviceName: "Deep Tissue Aromatherapy & Scalp Reset",
      category: "Scalp & Wellness",
      stylistName: "Clara Bennett (Spa Director)",
      chairLabel: "Spa Room 01",
      date: "2026-10-27",
      startTime: "15:00",
      durationMin: 90,
      priceUsd: 210,
      status: "Confirmed",
      updatedAt: "2026-10-24 17:30",
    },
    {
      id: "APT-414",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Audrey Cho",
      guestPhone: "(425) 555-0199",
      membershipTier: "VIP Wellness",
      serviceName: "Silk Press & Amino Moisture Infusion",
      category: "Keratin & Smoothing",
      stylistName: "Chloe Takahashi (Keratin Specialist)",
      chairLabel: "Chair 06",
      date: "2026-10-28",
      startTime: "13:00",
      durationMin: 90,
      priceUsd: 190,
      status: "Confirmed",
      updatedAt: "2026-10-24 14:20",
    },
    {
      id: "APT-415",
      salonId: "SLN-PNW-05",
      salonName: "Fremont Urban Lounge",
      region: "Pacific Northwest",
      guestName: "Kieran Gallagher",
      guestPhone: "(206) 555-0177",
      membershipTier: "Standard Guest",
      serviceName: "Executive Scissor Cut & Hot Towel Finish",
      category: "Cut & Styling",
      stylistName: "Owen Sullivan (Senior Stylist)",
      chairLabel: "Chair 02",
      date: "2026-10-29",
      startTime: "10:30",
      durationMin: 45,
      priceUsd: 95,
      status: "Confirmed",
      updatedAt: "2026-10-24 11:15",
    },
    {
      id: "APT-416",
      salonId: "SLN-MW-01",
      salonName: "Lincoln Park House",
      region: "Midwest",
      guestName: "Madeline Porter",
      guestPhone: "(312) 555-0162",
      membershipTier: "Signature Member",
      serviceName: "Nordic Blonde Gloss & Trim",
      category: "Hair Color & Balayage",
      stylistName: "Freya Lindholm (Master Stylist)",
      chairLabel: "Chair 05",
      date: "2026-10-26",
      startTime: "13:00",
      durationMin: 120,
      priceUsd: 260,
      status: "Confirmed",
      updatedAt: "2026-10-24 16:00",
    },
  ];
}

export function createInitialInteractions(): CustomerInteraction[] {
  return [
    // 1. LIVE CHAT — Tough Question: Late-cancel / reschedule fee waiver on delayed flight
    {
      id: "INT-901",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Olivia Hawthorne",
      guestPhone: "(425) 555-0148",
      membershipTier: "VIP Wellness",
      channel: "Chat",
      lifecycle: "Live",
      startedAt: "Today · 09:38 AM",
      durationOrStatusLabel: "Live Chat · Active now",
      topic: "Flight delay reschedule & $65 late-fee dispute",
      sentiment: "Policy Question",
      hasToughQuestion: true,
      linkedAppointmentId: "APT-401",
      turns: [
        {
          id: "T-901-1",
          speaker: "Guest",
          speakerLabel: "Olivia Hawthorne (VIP Wellness)",
          timestamp: "09:38:12 AM",
          text: "Hi Bellevue team, my Alaska Airlines flight into SEA-TAC just got held on the tarmac in Denver for 2 hours. I won't make my 10:30 AM Dimensional Balayage with Sienna.",
        },
        {
          id: "T-901-2",
          speaker: "System",
          speakerLabel: "Booking Desk Bot",
          timestamp: "09:38:16 AM",
          text: "Automated Notice: Changes within 24 hours of a 150-minute color block are subject to a $65 late-modification fee.",
        },
        {
          id: "T-901-3",
          speaker: "Guest",
          speakerLabel: "Olivia Hawthorne (VIP Wellness)",
          timestamp: "09:40:04 AM",
          text: "Why am I being hit with a $65 fee when an airline delay is out of my control and I've been a VIP Wellness member for 2 years? Can you waive the fee and move me to tomorrow (Monday) at 11:00 AM with Sienna?",
          isToughQuestion: true,
        },
      ],
      pendingLiveUtterances: [
        {
          text: "I also have my boarding pass delay confirmation #AS418 if you need verification—also will my VIP 15% retail perk still apply if we move to Monday?",
          isToughQuestion: true,
        },
      ],
      aiAssist: {
        toughQuestion:
          "Why am I being hit with a $65 fee when an airline delay is out of my control and I've been a VIP Wellness member for 2 years? Can you waive the fee and move me to Monday at 11:00 AM?",
        suggestedAnswer:
          "Hi Olivia, safe travels! Under our VIP Wellness & Travel Delay Policy (§4.2), we are happy to waive the $65 late-modification fee completely when you rebook within 7 days. Sienna Mercer has an opening tomorrow, Monday Oct 26 at 11:00 AM—shall I lock that in for you now, with all your VIP perks intact?",
        keyPolicyPoints: [
          "Elevate Policy §4.2 authorizes immediate $65 fee waiver for airline/weather delays or VIP Wellness members rescheduling within 7 days.",
          "Sienna Mercer (Master Colorist) has Chair 02 open Mon Oct 26 at 11:00 AM.",
          "VIP 15% retail benefit & loyalty points carry over automatically.",
        ],
        policyReference: "Elevate Guest Care Policy §4.2 — Travel & VIP Waiver",
        recommendedActionType: "reschedule",
        recommendedActionSummary:
          "Reschedule APT-401 to Mon Oct 26 · 11:00 AM (Waive $65 fee)",
        recommendedDate: "2026-10-26",
        recommendedTime: "11:00",
        recommendedStylist: "Sienna Mercer (Master Colorist)",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "09:40:08 AM",
      },
    },

    // 2. LIVE VOICE TRANSCRIPT — Tough Question: Brassy highlight complaint demanding $310 refund vs redo
    {
      id: "INT-902",
      salonId: "SLN-PNW-02",
      salonName: "Capitol Hill Atelier",
      region: "Pacific Northwest",
      guestName: "Rachel Donovan",
      guestPhone: "(206) 555-0193",
      membershipTier: "Signature Member",
      channel: "Voice",
      lifecycle: "Live",
      startedAt: "Today · 09:44 AM",
      durationOrStatusLabel: "Live Voice Call · 03m 18s",
      topic: "Color brassiness escalation — refund vs. 14-day guarantee",
      sentiment: "Escalated",
      hasToughQuestion: true,
      linkedAppointmentId: "APT-402",
      turns: [
        {
          id: "T-902-1",
          speaker: "System",
          speakerLabel: "Voice Stream · Line 02",
          timestamp: "09:44:05 AM",
          text: "Live Voice Transcription connected · Caller verified: Rachel Donovan (Signature Member · Capitol Hill Atelier).",
        },
        {
          id: "T-902-2",
          speaker: "Guest",
          speakerLabel: "Rachel Donovan (Caller)",
          timestamp: "09:45:19 AM",
          text: "I'm calling before my 11:30 appointment today because after one sulfate-free wash at home, my highlights from last Saturday turned super warm and brassy around my face frame.",
        },
        {
          id: "T-902-3",
          speaker: "Guest",
          speakerLabel: "Rachel Donovan (Caller)",
          timestamp: "09:46:42 AM",
          text: "Honestly I shouldn't pay another $310 today—can you either refund my $310 card charge right now over the phone or convert today's 11:30 slot into a free master color correction?",
          isToughQuestion: true,
        },
      ],
      pendingLiveUtterances: [
        {
          text: "If Zoe adjusts the toner today at 11:30, is the bond-builder treatment included at zero charge too so my ends don't dry out?",
          isToughQuestion: true,
        },
      ],
      aiAssist: {
        toughQuestion:
          "Can you either refund my $310 card charge right now over the phone or convert today's 11:30 slot into a free master color correction?",
        suggestedAnswer:
          "Rachel, I completely understand how frustrating unwanted warmth is, and you will certainly not be charged again today. Under our 14-Day Service Satisfaction Guarantee (§3.4), we can convert your 11:30 AM booking with Master Balayage Specialist Zoe Callahan into a complimentary 45-minute cool-ash gloss refinement and bond-protecting masque at $0—would you like to come in at 11:30 AM or shift to a quieter afternoon time?",
        keyPolicyPoints: [
          "14-Day Satisfaction Guarantee (§3.4) covers complimentary 45-min tonal refinement + bond masque within 14 days of color service.",
          "Cash refunds are not issued blind over the phone prior to an in-studio Master Colorist assessment.",
          "Keep or adjust today's 11:30 AM slot at $0 complimentary refinement.",
        ],
        policyReference:
          "Elevate Service Guarantee §3.4 — 14-Day Color Refinement",
        recommendedActionType: "complimentary_adjustment",
        recommendedActionSummary:
          "Keep 11:30 AM with Zoe Callahan as $0 Guarantee Refinement (or Reschedule)",
        recommendedDate: "2026-10-25",
        recommendedTime: "14:30",
        recommendedStylist: "Zoe Callahan (Master Balayage)",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "09:46:45 AM",
      },
    },

    // 3. LIVE CHAT — Tough Clinical/Ingredient Question: Pregnancy safety of Keratin treatment
    {
      id: "INT-903",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Samantha Lin",
      guestPhone: "(425) 555-0172",
      membershipTier: "VIP Wellness",
      channel: "Chat",
      lifecycle: "Live",
      startedAt: "Today · 09:47 AM",
      durationOrStatusLabel: "Live Chat · Active now",
      topic: "Prenatal chemical safety for 2:00 PM Keratin Express",
      sentiment: "Policy Question",
      hasToughQuestion: true,
      linkedAppointmentId: "APT-403",
      turns: [
        {
          id: "T-903-1",
          speaker: "Guest",
          speakerLabel: "Samantha Lin (VIP Wellness)",
          timestamp: "09:47:11 AM",
          text: "Hello! I'm booked at 2:00 PM today for the Botanical Amino Keratin Express with Chloe.",
        },
        {
          id: "T-903-2",
          speaker: "Guest",
          speakerLabel: "Samantha Lin (VIP Wellness)",
          timestamp: "09:48:30 AM",
          text: "I just entered my second trimester of pregnancy—does your Botanical Amino Keratin release methylene glycol or formaldehyde gas under flat-iron heat, or should I cancel my 2:00 PM appointment?",
          isToughQuestion: true,
        },
      ],
      pendingLiveUtterances: [
        {
          text: "Could you send me the ingredient list or hold my slot for next week while I ask my OB-GYN without charging a cancellation fee?",
          isToughQuestion: true,
        },
      ],
      aiAssist: {
        toughQuestion:
          "Does your Botanical Amino Keratin release methylene glycol or formaldehyde gas under flat-iron heat, or should I cancel my 2:00 PM appointment?",
        suggestedAnswer:
          "Congratulations, Samantha! Our Botanical Amino Keratin Express is 100% free of formaldehyde, methylene glycol, and aldehyde-releasing compounds—it uses glyoxylic-free plant amino acids and cysteine. However, per our Prenatal Clinical Protocol (§2.1), we always recommend reviewing our SDS ingredient sheet with your OB-GYN first; we can either swap today's 2:00 PM slot to a pregnancy-safe Organic Hydro-Scalp Ritual or move/cancel your Keratin booking with zero fee while you check with your doctor.",
        keyPolicyPoints: [
          "Formula is 100% formaldehyde-free and methylene-glycol-free (amino-cysteine complex).",
          "Clinical Protocol §2.1 requires guest OB-GYN comfort confirmation for any heat-sealed smoothing service during pregnancy.",
          "Medical/prenatal holds qualify for automatic 100% fee-free reschedule or cancellation.",
        ],
        policyReference:
          "Elevate Clinical & Prenatal Protocol §2.1 — Ingredient Safety",
        recommendedActionType: "cancel_waive_fee",
        recommendedActionSummary:
          "Reschedule to Wed Oct 28 (Post OB-GYN check) or Cancel with $0 prenatal waiver",
        recommendedDate: "2026-10-28",
        recommendedTime: "14:00",
        recommendedStylist: "Chloe Takahashi (Keratin Specialist)",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "09:48:34 AM",
      },
    },

    // 4. LIVE VOICE TRANSCRIPT — Childcare conflict reschedule / package credit expiration question
    {
      id: "INT-904",
      salonId: "SLN-PNW-03",
      salonName: "Pearl District Sanctuary",
      region: "Pacific Northwest",
      guestName: "Daniela Vega",
      guestPhone: "(503) 555-0164",
      membershipTier: "Signature Member",
      channel: "Voice",
      lifecycle: "Live",
      startedAt: "Today · 09:49 AM",
      durationOrStatusLabel: "Live Voice Call · 01m 52s",
      topic: "1:00 PM Head Spa reschedule & expiring package credit",
      sentiment: "Scheduling",
      hasToughQuestion: true,
      linkedAppointmentId: "APT-404",
      turns: [
        {
          id: "T-904-1",
          speaker: "System",
          speakerLabel: "Voice Stream · Line 01",
          timestamp: "09:49:02 AM",
          text: "Live Voice Transcription connected · Pearl District Sanctuary · Caller: Daniela Vega.",
        },
        {
          id: "T-904-2",
          speaker: "Guest",
          speakerLabel: "Daniela Vega (Caller)",
          timestamp: "09:49:48 AM",
          text: "Hi there, our sitter just called out sick so I can't make my 1:00 PM Japanese Head Spa with Mila today. My 3-pack wellness voucher says it expires Oct 26—if we move to Tuesday Oct 27 at 2:00 PM, do I lose my prepaid $215 voucher?",
          isToughQuestion: true,
        },
      ],
      pendingLiveUtterances: [
        {
          text: "Tuesday Oct 27 at 2:00 PM with Mila works great if you can extend that voucher by one day!",
          isToughQuestion: false,
        },
      ],
      aiAssist: {
        toughQuestion:
          "My 3-pack wellness voucher says it expires Oct 26—if we move to Tuesday Oct 27 at 2:00 PM, do I lose my prepaid $215 voucher?",
        suggestedAnswer:
          "No problem at all, Daniela—hope everyone at home feels better! Under our Package Grace Policy (§5.3), Regional & Studio Managers can grant a 14-day courtesy voucher extension when a booking originally scheduled before expiration is moved. Mila Novak is open Tuesday, Oct 27 at 2:00 PM, and your $215 prepaid voucher will apply in full with no late fee.",
        keyPolicyPoints: [
          "Package Grace Policy §5.3 permits a 14-day voucher extension when the original appointment preceded the expiry date.",
          "Mila Novak (Scalp & Spa Lead) has Suite 01 available Tue Oct 27 at 14:00.",
          "One-time childcare emergency qualifies for $0 same-day move waiver.",
        ],
        policyReference: "Elevate Membership & Voucher Policy §5.3",
        recommendedActionType: "reschedule",
        recommendedActionSummary:
          "Reschedule APT-404 to Tue Oct 27 · 02:00 PM with Mila Novak",
        recommendedDate: "2026-10-27",
        recommendedTime: "14:00",
        recommendedStylist: "Mila Novak (Scalp & Spa Lead)",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "09:49:52 AM",
      },
    },

    // 5. LIVE CHAT (Southwest — visible to COO / Admin)
    {
      id: "INT-905",
      salonId: "SLN-SW-01",
      salonName: "Scottsdale Kierland Retreat",
      region: "Southwest",
      guestName: "Genevieve Sterling",
      guestPhone: "(480) 555-0126",
      membershipTier: "VIP Wellness",
      channel: "Chat",
      lifecycle: "Live",
      startedAt: "Today · 09:43 AM",
      durationOrStatusLabel: "Live Chat · Active now",
      topic: "Pre-gala peel sensitivity & UV downtime question",
      sentiment: "Policy Question",
      hasToughQuestion: true,
      linkedAppointmentId: "APT-408",
      turns: [
        {
          id: "T-905-1",
          speaker: "Guest",
          speakerLabel: "Genevieve Sterling (VIP Wellness)",
          timestamp: "09:43:20 AM",
          text: "Before my 11:00 AM spa session in Scottsdale, can Savannah add the 20% Glycolic Peel if I have an outdoor charity gala tomorrow afternoon in 88°F sun, or will my skin flake?",
          isToughQuestion: true,
        },
      ],
      aiAssist: {
        toughQuestion:
          "Can Savannah add the 20% Glycolic Peel if I have an outdoor charity gala tomorrow afternoon in 88°F sun, or will my skin flake?",
        suggestedAnswer:
          "Great catch asking ahead, Genevieve! Per our Esthetics Sun-Safety Protocol (§2.4), we advise against a 20% Glycolic Peel within 72 hours of high-UV outdoor events due to photosensitivity and micro-flaking. Instead, Savannah can perform our Zero-Downtime Oxygen & Peptide Glow Infusion at 11:00 AM today for immediate event radiance, and schedule your Glycolic Peel next week.",
        keyPolicyPoints: [
          "Esthetics Protocol §2.4 contraindicates 20% Glycolic Peels within 72h of prolonged desert UV exposure.",
          "Substitute Oxygen & Peptide Glow Infusion requires zero recovery time.",
        ],
        policyReference: "Elevate Esthetics Clinical Protocol §2.4 — UV Safety",
        recommendedActionType: "none",
        recommendedActionSummary:
          "Keep 11:00 AM slot; swap peel add-on to Zero-Downtime Peptide Glow",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "09:43:25 AM",
      },
    },

    // 6. PREVIOUS CHAT — Cross-region VIP membership credit transfer (Kirkland)
    {
      id: "INT-906",
      salonId: "SLN-PNW-04",
      salonName: "Kirkland Waterfront Spa",
      region: "Pacific Northwest",
      guestName: "Victoria Kingsley",
      guestPhone: "(425) 555-0119",
      membershipTier: "VIP Wellness",
      channel: "Chat",
      lifecycle: "Previous",
      startedAt: "Today · 08:45 AM",
      durationOrStatusLabel: "Completed Chat · 6 msgs",
      topic: "Cross-region Scottsdale to Kirkland VIP credit redemption",
      sentiment: "Resolved",
      hasToughQuestion: true,
      linkedAppointmentId: "APT-405",
      turns: [
        {
          id: "T-906-1",
          speaker: "Guest",
          speakerLabel: "Victoria Kingsley (VIP Wellness)",
          timestamp: "08:45:10 AM",
          text: "Good morning! My home membership is billed at Scottsdale Kierland, but I'm in Kirkland this week. Can I redeem two rolled-over VIP facial credits for my 9:30 AM Peptide Facial without an out-of-region surcharge?",
          isToughQuestion: true,
        },
        {
          id: "T-906-2",
          speaker: "Manager",
          speakerLabel: "Studio Operations Desk",
          timestamp: "08:46:32 AM",
          text: "Good morning Victoria! Yes—under Elevate Membership Policy §5.1, VIP Wellness credits are 100% portable across all 20 studios nationwide with zero cross-region fee. One credit covers your $195 Peptide Facial at 9:30 AM today.",
        },
        {
          id: "T-906-3",
          speaker: "Guest",
          speakerLabel: "Victoria Kingsley (VIP Wellness)",
          timestamp: "08:47:15 AM",
          text: "Wonderful, heading over now—see you at 9:30!",
        },
      ],
      aiAssist: {
        toughQuestion:
          "Can I redeem rolled-over Scottsdale VIP facial credits in Kirkland without an out-of-region surcharge?",
        suggestedAnswer:
          "Yes! Under Elevate Membership Policy §5.1, VIP Wellness credits redeem seamlessly across all 20 Elevate studios nationwide with zero transfer surcharge.",
        keyPolicyPoints: [
          "Nationwide portability across all 4 regions with $0 transfer fee.",
          "Guest checked in on time at 09:20 AM.",
        ],
        policyReference: "Elevate Membership Policy §5.1 — Multi-Studio Reciprocity",
        recommendedActionType: "none",
        recommendedActionSummary: "Resolved · Guest Checked In (APT-405)",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "08:45:14 AM",
      },
    },

    // 7. PREVIOUS VOICE TRANSCRIPT — PPD hair dye allergy question (Bellevue, Oct 24)
    {
      id: "INT-907",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Grace Callahan",
      guestPhone: "(425) 555-0155",
      membershipTier: "Signature Member",
      channel: "Voice",
      lifecycle: "Previous",
      startedAt: "Oct 24 · 09:50 AM",
      durationOrStatusLabel: "Recorded Call · 04m 18s",
      topic: "PPD allergy verification for Lived-In Brunette gloss",
      sentiment: "Resolved",
      hasToughQuestion: true,
      linkedAppointmentId: "APT-395",
      turns: [
        {
          id: "T-907-1",
          speaker: "System",
          speakerLabel: "Recorded Voice Transcript · Call #8821",
          timestamp: "09:50:00 AM",
          text: "Archived Voice Transcript · Duration 04m 18s · Bellevue Flagship Studio.",
        },
        {
          id: "T-907-2",
          speaker: "Guest",
          speakerLabel: "Grace Callahan (Caller)",
          timestamp: "09:51:12 AM",
          text: "Hi, I developed a mild contact sensitivity to para-phenylenediamine (PPD) last year. Does Liam have a PPD-free, resorcinol-free demi-permanent brunette gloss for my 11:00 AM appointment?",
          isToughQuestion: true,
        },
        {
          id: "T-907-3",
          speaker: "Manager",
          speakerLabel: "Bellevue Manager Desk",
          timestamp: "09:52:40 AM",
          text: "Thanks for flagging that, Grace. We carry our Clean- Botanicals Zero-PPD / Zero-Resorcinol Demi Gloss line specifically for sensitive scalps, and Liam will perform a rapid 20-minute behind-ear skin check plus barrier serum before application.",
        },
        {
          id: "T-907-4",
          speaker: "Guest",
          speakerLabel: "Grace Callahan (Caller)",
          timestamp: "09:53:55 AM",
          text: "That puts my mind completely at ease. Thank you!",
        },
      ],
      aiAssist: {
        toughQuestion:
          "Does the studio carry a PPD-free, resorcinol-free demi-permanent brunette gloss for contact sensitivity?",
        suggestedAnswer:
          "Yes—we stock Clean-Botanicals Zero-PPD / Zero-Resorcinol Demi Gloss and pair every sensitive-scalp color service with a complimentary barrier serum and patch check per Clinical Policy §2.2.",
        keyPolicyPoints: [
          "Zero-PPD & Zero-Resorcinol demi-permanent line available at all flagship color bars.",
          "Mandatory allergy flag added to guest profile.",
        ],
        policyReference: "Elevate Clinical Protocol §2.2 — Dye Sensitivity",
        recommendedActionType: "none",
        recommendedActionSummary: "Completed safely on Oct 24 (APT-395)",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "09:51:15 AM",
      },
    },

    // 8. PREVIOUS VOICE TRANSCRIPT — Rescheduled appointment due to bridge closure (Pearl District, Oct 24)
    {
      id: "INT-908",
      salonId: "SLN-PNW-03",
      salonName: "Pearl District Sanctuary",
      region: "Pacific Northwest",
      guestName: "Julianna Reeves",
      guestPhone: "(503) 555-0122",
      membershipTier: "Standard Guest",
      channel: "Voice",
      lifecycle: "Previous",
      startedAt: "Oct 24 · 12:04 PM",
      durationOrStatusLabel: "Recorded Call · 03m 06s",
      topic: "I-5 bridge closure reschedule to Monday Oct 26",
      sentiment: "Resolved",
      hasToughQuestion: false,
      linkedAppointmentId: "APT-411",
      turns: [
        {
          id: "T-908-1",
          speaker: "System",
          speakerLabel: "Recorded Voice Transcript · Call #8849",
          timestamp: "12:04:00 PM",
          text: "Archived Voice Transcript · Duration 03m 06s · Pearl District Sanctuary.",
        },
        {
          id: "T-908-2",
          speaker: "Guest",
          speakerLabel: "Julianna Reeves (Caller)",
          timestamp: "12:04:45 PM",
          text: "Hi, ODOT closed two lanes on the Interstate Bridge and GPS says I'm 75 minutes delayed for my 2:30 PM cut with Avery. Can we move to Monday afternoon?",
        },
        {
          id: "T-908-3",
          speaker: "Manager",
          speakerLabel: "Pearl District Desk",
          timestamp: "12:06:10 PM",
          text: "We saw the bridge alert! I've moved your Signature Cut & Botanical Gloss with Avery Kwon to Monday, Oct 26 at 2:00 PM and waived the same-day change fee.",
        },
      ],
      aiAssist: {
        toughQuestion:
          "Guest stuck in DOT bridge closure requesting same-day move without penalty.",
        suggestedAnswer:
          "Move booking to Monday Oct 26 at 2:00 PM with Avery Kwon and apply the municipal transit/traffic courtesy waiver (§4.2).",
        keyPolicyPoints: [
          "Rescheduled cleanly from Oct 24 14:30 to Mon Oct 26 14:00 (APT-411).",
        ],
        policyReference: "Elevate Guest Care Policy §4.2",
        recommendedActionType: "none",
        recommendedActionSummary: "Rescheduled to Mon Oct 26 · 02:00 PM",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "12:04:50 PM",
      },
    },

    // 9. PREVIOUS CHAT — Bridal party add-on capacity question (Bellevue, Oct 24)
    {
      id: "INT-909",
      salonId: "SLN-PNW-01",
      salonName: "Bellevue Flagship Studio",
      region: "Pacific Northwest",
      guestName: "Lauren Pembroke",
      guestPhone: "(425) 555-0188",
      membershipTier: "VIP Wellness",
      channel: "Chat",
      lifecycle: "Previous",
      startedAt: "Oct 24 · 04:32 PM",
      durationOrStatusLabel: "Completed Chat · 5 msgs",
      topic: "Bridal Suite companion blowout add-on for Monday Oct 26",
      sentiment: "Resolved",
      hasToughQuestion: false,
      linkedAppointmentId: "APT-410",
      turns: [
        {
          id: "T-909-1",
          speaker: "Guest",
          speakerLabel: "Lauren Pembroke (VIP Wellness)",
          timestamp: "04:32:18 PM",
          text: "Hi! For my Monday 10:00 AM Bridal Trial & Facial, can my maid of honor join me at 10:30 AM for a blowout even if she isn't a member?",
        },
        {
          id: "T-909-2",
          speaker: "Manager",
          speakerLabel: "Bellevue Concierge",
          timestamp: "04:35:04 PM",
          text: "Absolutely, Lauren! Your VIP Wellness guest-pass benefit lets your maid of honor book at your 15% member rate. We reserved Liam Kensington at 10:30 AM right beside the Bridal Suite.",
        },
      ],
      aiAssist: {
        toughQuestion:
          "Can a non-member companion use VIP Wellness guest pricing for a bridal trial add-on?",
        suggestedAnswer:
          "Yes—VIP Wellness members receive 2 companion guest passes per quarter granting 15% off companion styling services (§5.2).",
        keyPolicyPoints: [
          "VIP Companion Pass (§5.2) applies 15% member privilege to same-day companion service.",
        ],
        policyReference: "Elevate VIP Benefits §5.2 — Companion Passes",
        recommendedActionType: "none",
        recommendedActionSummary: "Confirmed for Mon Oct 26 · 10:00 AM",
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: "04:32:22 PM",
      },
    },
  ];
}

export function buildDeterministicAiAssist(
  question: string,
  context?: {
    guestName?: string;
    salonName?: string;
    stylistName?: string;
  }
): Omit<AIAssistSuggestion, "generatedBy" | "generatedAt"> {
  const q = question.toLowerCase();
  const guest = context?.guestName?.split(" ")[0] ?? "there";

  if (
    q.includes("fee") ||
    q.includes("$65") ||
    q.includes("flight") ||
    q.includes("delay") ||
    q.includes("traffic") ||
    q.includes("waive")
  ) {
    return {
      toughQuestion: question,
      suggestedAnswer: `Hi ${guest}, we completely understand unexpected travel or emergency delays. Under Elevate Guest Care Policy (§4.2), I can waive the $65 late-modification fee as a one-time courtesy when we reschedule your visit within the next 7 days—would tomorrow morning or early afternoon work best for you?`,
      keyPolicyPoints: [
        "Policy §4.2 authorizes a one-time $65 late-fee waiver for travel delays, medical/family emergencies, or VIP/Signature members rebooking within 7 days.",
        "Preserves guest lifetime value while refilling next-day studio capacity.",
      ],
      policyReference: "Elevate Guest Care Policy §4.2 — Courtesy Fee Waiver",
      recommendedActionType: "reschedule",
      recommendedActionSummary:
        "Reschedule within 7 days and toggle Waive $65 Fee",
      recommendedDate: "2026-10-26",
      recommendedTime: "11:00",
    };
  }

  if (
    q.includes("brassy") ||
    q.includes("refund") ||
    q.includes("redo") ||
    q.includes("uneven") ||
    q.includes("unhappy") ||
    q.includes("fix")
  ) {
    return {
      toughQuestion: question,
      suggestedAnswer: `Hi ${guest}, thank you for letting us know right away—we want you to love your result and you won't pay extra to get it right. Under our 14-Day Service Satisfaction Guarantee (§3.4), we can book a complimentary 45-minute Master Colorist tonal refinement and bond masque at $0 so we can assess and perfect the tone in person.`,
      keyPolicyPoints: [
        "14-Day Satisfaction Guarantee (§3.4) provides a $0 45-minute tonal/cut refinement with a Senior or Master Stylist.",
        "Card refunds require in-studio evaluation first; 89% of guests retain membership after a prompt complimentary refinement.",
      ],
      policyReference:
        "Elevate Service Guarantee §3.4 — 14-Day Satisfaction Redo",
      recommendedActionType: "complimentary_adjustment",
      recommendedActionSummary:
        "Schedule $0 45-min Guarantee Refinement with Master Stylist",
      recommendedDate: "2026-10-25",
      recommendedTime: "14:30",
    };
  }

  if (
    q.includes("pregnan") ||
    q.includes("trimester") ||
    q.includes("formaldehyde") ||
    q.includes("allergy") ||
    q.includes("ppd") ||
    q.includes("chemical") ||
    q.includes("ingredient") ||
    q.includes("safe")
  ) {
    return {
      toughQuestion: question,
      suggestedAnswer: `Hi ${guest}, guest safety always comes first. Our Botanical Amino smoothing and Zero-PPD demi-gloss lines contain zero formaldehyde, methylene glycol, or PPD; however, per Clinical Protocol (§2.1–2.2), we are glad to email our full SDS ingredient sheet for your physician's sign-off and either switch today's visit to an organic botanical treatment or hold/cancel your booking with zero fee.`,
      keyPolicyPoints: [
        "Botanical Amino Keratin is 100% formaldehyde- and aldehyde-free; Clean-Botanicals Demi Gloss is PPD- and resorcinol-free.",
        "Clinical Protocol §2.1 grants automatic $0 fee-free reschedule or cancellation for prenatal or allergy holds.",
      ],
      policyReference:
        "Elevate Clinical Safety Protocol §2.1–2.2 — Prenatal & Allergy Care",
      recommendedActionType: "cancel_waive_fee",
      recommendedActionSummary:
        "Offer organic swap or fee-free prenatal/clinical reschedule",
      recommendedDate: "2026-10-28",
      recommendedTime: "14:00",
    };
  }

  if (
    q.includes("credit") ||
    q.includes("voucher") ||
    q.includes("expire") ||
    q.includes("membership") ||
    q.includes("freeze") ||
    q.includes("transfer")
  ) {
    return {
      toughQuestion: question,
      suggestedAnswer: `Hi ${guest}, your membership benefits are protected! Under Elevate Membership Policy (§5.1–5.3), monthly credits transfer across all 20 Elevate studios nationwide with zero fee, and managers can apply a 14-day courtesy grace extension on expiring package vouchers when rescheduling.`,
      keyPolicyPoints: [
        "VIP & Signature credits transfer across all 20 salons with $0 surcharge (§5.1).",
        "14-day voucher grace extension permitted when rescheduling active bookings (§5.3).",
      ],
      policyReference:
        "Elevate Membership & Voucher Policy §5.1–5.3 — Credit Protection",
      recommendedActionType: "reschedule",
      recommendedActionSummary:
        "Reschedule appointment and honor prepaid voucher/credit",
      recommendedDate: "2026-10-27",
      recommendedTime: "14:00",
    };
  }

  return {
    toughQuestion: question,
    suggestedAnswer: `Hi ${guest}, thank you for reaching out to ${
      context?.salonName ?? "our studio"
    }. I've reviewed your booking details and our guest care policy—we can accommodate your request today with flexible priority scheduling or a courtesy adjustment so your visit is seamless. Let me confirm the exact time that works best for you.`,
    keyPolicyPoints: [
      "Verify linked guest appointment tier and 24-hour modification eligibility.",
      "Document interaction reason on calendar record for studio stylists.",
    ],
    policyReference: "Elevate Guest Care Handbook §1.4 — Concierge Resolution",
    recommendedActionType: "none",
    recommendedActionSummary: "Confirm guest preference & update calendar slot",
  };
}

export async function requestCockpitAiAssist(params: {
  toughQuestion: string;
  guestName?: string;
  membershipTier?: string;
  salonName?: string;
  stylistName?: string;
  channel?: string;
  appointmentSummary?: string;
  recentTranscript?: string;
  advisorPaused?: boolean;
}): Promise<{
  suggestion: AIAssistSuggestion;
  tokensUsed: number;
  latencyMs: number;
  usedGemini: boolean;
}> {
  const base = buildDeterministicAiAssist(params.toughQuestion, {
    guestName: params.guestName,
    salonName: params.salonName,
    stylistName: params.stylistName,
  });
  const nowTime = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (params.advisorPaused) {
    return {
      suggestion: {
        ...base,
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: nowTime,
      },
      tokensUsed: 0,
      latencyMs: 18,
      usedGemini: false,
    };
  }

  try {
    const resp = await fetch("/api/cockpit/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toughQuestion: params.toughQuestion,
        guestName: params.guestName,
        membershipTier: params.membershipTier,
        salonName: params.salonName,
        channel: params.channel,
        appointmentSummary: params.appointmentSummary,
        recentTranscript: params.recentTranscript,
        fallbackSuggestion: {
          suggestedAnswer: base.suggestedAnswer,
          keyPolicyPoints: base.keyPolicyPoints,
          policyReference: base.policyReference,
          recommendedActionSummary: base.recommendedActionSummary,
        },
      }),
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const usedGemini = Boolean(data.usedGemini);
    const totalTokens = data.usage?.totalTokens ?? (usedGemini ? 420 : 0);

    return {
      suggestion: {
        ...base,
        suggestedAnswer: data.suggestedAnswer || base.suggestedAnswer,
        keyPolicyPoints: Array.isArray(data.keyPolicyPoints)
          ? data.keyPolicyPoints
          : base.keyPolicyPoints,
        policyReference: data.policyReference || base.policyReference,
        recommendedActionSummary:
          data.recommendedActionSummary || base.recommendedActionSummary,
        generatedBy: usedGemini
          ? "Gemini 3.8 Flash"
          : "Certified Salon Policy Engine",
        generatedAt: nowTime,
      },
      tokensUsed: totalTokens,
      latencyMs: Number(data.latencyMs ?? 120),
      usedGemini,
    };
  } catch {
    return {
      suggestion: {
        ...base,
        generatedBy: "Certified Salon Policy Engine",
        generatedAt: nowTime,
      },
      tokensUsed: 0,
      latencyMs: 35,
      usedGemini: false,
    };
  }
}
