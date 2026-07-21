// tasks.ts — raw data behind the `list_available_tasks` tool.
// Sourced from https://www.mysherah.com/tasks-we-help-with — update this
// file (not tools.ts) when the site's task list changes.
export const TASKS_WE_HELP_WITH = {
  source: "https://www.mysherah.com/tasks-we-help-with",
  categories: [
    {
      category: "Indoor Home",
      tasks: [
        "Home Organization and De-Cluttering",
        "Finding House Cleaners",
        "Interior Decorating Assistance",
        "Donation Pick-up and Drop-off",
        "Reselling Clothes and Furniture Online",
        "Better Systems for Keeping up with Laundry",
        "Booking and Meeting Repair Companies",
        "Suggesting Home Maintenance Updates",
        "Gathering Estimates for Repairs",
      ],
    },
    {
      category: "Outdoor Home",
      tasks: [
        "Scheduling Lawn Care",
        "Recommending Landscapers",
        "Gutter Cleaning, Window Washing, Power Washing",
        "Installing and Winterizing Irrigation Systems",
      ],
    },
    {
      category: "Admin & Organization",
      tasks: [
        "Email and Calendar Management",
        "Digital Clutter Cleanout and Organization",
        "Family Calendar Management",
        "Adding School Calendar to Your Calendar",
        "Adding Kids' Activities to Your Calendar",
        "Reminders for Birthdays and Anniversaries",
        "Date Night Dinner Reservations & Booking Sitters",
      ],
    },
    {
      category: "Kids",
      tasks: [
        "Researching and Booking Camps and Activities",
        "Recommending Schools and Tutors",
        "Researching and Booking Sports and Music Classes",
        "Booking Doctors Appointments",
        "Booking Sitters and Finding Long-Term Nannies",
        "Clothes Shopping and Seasonal Closet Turnover",
        "Reselling and Donating Clothes and Gear",
        "Shopping and Wrapping Teacher and Birthday Gifts",
      ],
    },
    {
      category: "Pet Care",
      tasks: [
        "Booking Vet Appointments",
        "Picking Up and Delivering Pet Prescriptions",
        "Booking Dog Walkers and Sitters",
        "Booking Doggie Daycares and Groomers",
        "Booking Stays for Boarding during Travel",
      ],
    },
    {
      category: "Meals & Groceries",
      tasks: [
        "Weekly Meal Planning",
        "Recommending Local Private Chefs",
        "Ordering Online Grocery Delivery",
        "Recommending and Booking Catering for Parties",
        "Setting Up Online Meal Delivery Calendar",
      ],
    },
    {
      category: "Clothing",
      tasks: [
        "Adult and Kids Clothes Clean Out and Organization",
        "Managing Change-out of Seasons and Sizes",
        "Picking up and Dropping off Donations",
        "Managing Alterations and Mending of Clothes and Shoes",
        "Clothes Shopping and Reselling Online",
        "Recommending and Booking a Wardrobe Stylist",
      ],
    },
    {
      category: "Travel",
      tasks: [
        "Researching Family Vacations and Getaways",
        "Booking Passport Appointments",
        "Recommending Flights and Hotels",
        "Booking Car Rentals and Golf Carts",
        "Researching and Booking VRBOs and AirBnBs",
        "Recommending and Booking Activities during Travel",
        "Planning Anniversaries, Birthday Parties, Girls' Weekends",
      ],
    },
    {
      category: "Shopping",
      tasks: [
        "Birthday and Anniversary Presents",
        "Buying and Wrapping Gifts",
        "Sending Gifts for Promotions",
        "Sending Flowers, Care Packages, and Gift Baskets",
        "Ordering and Shipping Personalized Baby Gifts",
        "Christmas Shopping and Wrapping",
        "Purchasing and Wrapping Teacher Gifts & Gift Cards",
        "Purchasing Sports Equipment and Ordering Uniforms",
        "Buying Gifts for Coworkers and Team Gifts",
        "Writing and Sending Thank You Cards",
      ],
    },
    {
      category: "Finances",
      tasks: [
        "Recommending Accountants for Tax Prep",
        "Recommending Certified Financial Planners",
        "Recommend Attorneys for Trust and Estate Planning",
      ],
    },
    {
      category: "Wellness",
      tasks: [
        "Recommending and Registering for Gym Memberships",
        "Booking Healthcare and Doctor Appointments",
        "Booking Hair, Nail, Skin Care, and Massage Appointments",
        "Picking Up and Delivering Prescriptions",
      ],
    },
    {
      category: "Party Planning",
      tasks: [
        "Researching and Planning Birthday Parties",
        "Planning Private Dinner Parties",
        "Booking Anniversary Dinners",
        "Booking Work Events and Happy Hours",
        "Planning Holiday Parties",
      ],
    },
    {
      category: "Holidays",
      tasks: [
        "Booking Photographer",
        "Designing, Signing, and Mailing Holiday Cards",
        "Gift Shopping and Wrapping",
        "Travel Planning",
        "Party Planning",
      ],
    },
    {
      category: "Other",
      tasks: [
        "Career Assistance with Resumes and LinkedIn Profiles",
        "Finding Executive Coaches",
        "Car Washing, Detailing, Repairs, and Inspections",
      ],
    },
  ],
} as const;
