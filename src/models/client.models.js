import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    // Basic Information
    clientType: {
      type: String,
      enum: ["individual", "business", "non-profit", "trust", "estate"],
      required: [true, "Client type is required"],
      index: true,
    },

    // Personal/Business Information
    firstName: {
      type: String,
      trim: true,
      required: function () {
        return (
          this.clientType === "individual" ||
          this.clientType === "trust" ||
          this.clientType === "estate"
        );
      },
      minlength: [2, "First name must be at least 2 characters long"],
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      required: function () {
        return (
          this.clientType === "individual" ||
          this.clientType === "trust" ||
          this.clientType === "estate"
        );
      },
      minlength: [2, "Last name must be at least 2 characters long"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    businessName: {
      type: String,
      trim: true,
      required: function () {
        return (
          this.clientType === "business" || this.clientType === "non-profit"
        );
      },
      minlength: [2, "Business name must be at least 2 characters long"],
      maxlength: [100, "Business name cannot exceed 100 characters"],
    },

    // Contact Information
    email: {
      type: String,
      required: [true, "Email address is required"],
      trim: true,
      lowercase: true,
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
      index: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [
        /^\(\d{3}\)\s\d{3}-\d{4}$/,
        "Please provide a valid phone number in format (XXX) XXX-XXXX",
      ],
    },
    alternativePhone: {
      type: String,
      trim: true,
      match: [
        /^\(\d{3}\)\s\d{3}-\d{4}$/,
        "Please provide a valid phone number in format (XXX) XXX-XXXX",
      ],
    },

    // Business Details
    industry: {
      type: String,
      enum: [
        "technology",
        "healthcare",
        "retail",
        "manufacturing",
        "finance",
        "real-estate",
        "hospitality",
        "construction",
        "education",
        "other",
      ],
      required: false,
    },
    website: {
      type: String,
      trim: true,
      match: [
        /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
        "Please provide a valid website URL",
      ],
    },
    annualRevenue: {
      type: String,
      trim: true,
      default: "$0",
    },
    employeeCount: {
      type: Number,
      min: [0, "Number of employees cannot be negative"],
      default: 0,
    },
    taxId: {
      type: String,
      trim: true,
      uppercase: true,
      match: [
        /^\d{2}-\d{7}$/,
        "Please provide a valid Tax ID in format XX-XXXXXXX",
      ],
      sparse: true,
      unique: false,
    },

    // Address Information
    address: {
      type: String,
      required: [true, "Street address is required"],
      trim: true,
      maxlength: [200, "Address cannot exceed 200 characters"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [50, "City name cannot exceed 50 characters"],
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      uppercase: true,
      minlength: [2, "State must be 2 characters"],
      maxlength: [2, "State must be 2 characters"],
    },
    zipCode: {
      type: String,
      required: [true, "Zip code is required"],
      trim: true,
      match: [/^\d{5}$/, "Please provide a valid 5-digit zip code"],
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      default: "USA",
      enum: ["USA", "Canada", "UK", "Australia"],
    },

    // Services & Preferences
    services: {
      type: [
        {
          type: String,
          enum: [
            "tax-filing",
            "tax-planning",
            "payroll",
            "bookkeeping",
            "audit",
            "business-formation",
            "financial-reporting",
            "consulting",
            "other",
          ],
        },
      ],
      required: [true, "At least one service is required"],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "Please select at least one service",
      },
    },
    preferredContact: {
      type: String,
      enum: ["email", "phone", "sms", "in-person"],
      default: "email",
    },
    preferredLanguage: {
      type: String,
      enum: ["english", "spanish", "french", "chinese"],
      default: "english",
    },
    taxFilingMonth: {
      type: String,
      enum: [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ],
      required: false,
    },
    accountingYear: {
      type: String,
      enum: ["calendar", "fiscal-july", "fiscal-october", "custom"],
      default: "calendar",
    },

    // Additional Information
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    referralSource: {
      type: String,
      trim: true,
      maxlength: [100, "Referral source cannot exceed 100 characters"],
    },
    marketingConsent: {
      type: Boolean,
      default: false,
    },

    // Status & Assignment
    status: {
      type: String,
      enum: ["active", "pending", "inactive", "on-hold"],
      default: "pending",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    assignedToName: {
      type: String,
      trim: true,
    },

    // Financial & Tax Information
    taxFilingStatus: {
      type: String,
      enum: ["not-started", "in-progress", "review", "filed", "amended"],
      default: "not-started",
    },
    accountingMethod: {
      type: String,
      enum: ["cash", "accrual", "hybrid"],
      default: "accrual",
    },
    fiscalYearEnd: {
      type: String,
      enum: ["december", "march", "june", "september", "custom"],
      default: "december",
    },
    businessStructure: {
      type: String,
      enum: [
        "sole-proprietorship",
        "partnership",
        "llc",
        "s-corporation",
        "c-corporation",
        "non-profit",
        "trust",
        "estate",
      ],
      required: false,
    },
  },
  { timestamps: true },
);

export const Client = mongoose.model("Client", clientSchema);
