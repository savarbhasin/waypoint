import type { Workflow } from "@/types/workflow";

export const seedWorkflows: Workflow[] = [
  {
    name: "github_star_repo",
    description: "Searches GitHub for a repository and stars it.",
    created_at: "2026-06-12T09:14:00.000Z",
    parameters: ["repo_query"],
    steps: [
      { type: "navigate", instruction: "Open GitHub.", url: "https://github.com", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "click", instruction: "Open the site search.", command: 'get_by_role("button", name="Search or jump to")', sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "fill", instruction: "Enter the repository to search for.", command: 'get_by_role("combobox", name="Search")', value: "{repo_query}", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "wait", instruction: "Let search results settle.", duration: 1.5, sleep_before: 0, skip_command: false, max_retries: 3 },
      { type: "click", instruction: "Open the top repository result.", command: 'get_by_test_id("results-list").get_by_role("link").first', sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "click", instruction: "Star the repository.", command: 'get_by_role("button", name="Star")', sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "extract", instruction: "Read the updated star count.", method: "selectors", extraction_selectors: { star_count: "#repo-stars-counter-star" }, sleep_before: 0.5, duration: 0, skip_command: false, max_retries: 3 },
    ],
  },
  {
    name: "job_board_apply",
    description: "Searches a job board by role and location, then lets an AI agent open and apply to the first listing.",
    created_at: "2026-06-24T17:41:00.000Z",
    parameters: ["role", "location"],
    steps: [
      { type: "navigate", instruction: "Open the job board.", url: "https://jobs.example.com", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "fill", instruction: "Enter the role to search for.", command: 'get_by_placeholder("Job title or keyword")', value: "{role}", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "select", instruction: "Choose the location filter.", command: 'get_by_label("Location")', value: "{location}", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "click", instruction: "Run the search.", command: 'get_by_role("button", name="Search jobs")', sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "ai", instruction: "Open the first listing and submit an application with the stored profile.", task: "Open the first job listing in the results list, click Apply, and submit the application using the pre-filled profile.", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "extract", instruction: "Confirm the application was submitted.", method: "screenshot", extract_instruction: "Look at the confirmation screen and report whether the application succeeded.", extraction_format: { submitted: "boolean", confirmation_id: "string | null" }, sleep_before: 1, duration: 0, skip_command: false, max_retries: 3 },
    ],
  },
  {
    name: "team_dashboard_login",
    description: "Logs into the internal team dashboard and opens the billing tab. The post-login menu item carries a session-scoped id, so that click is healed by AI on every run.",
    created_at: "2026-07-01T11:02:00.000Z",
    parameters: ["email", "password"],
    steps: [
      { type: "navigate", instruction: "Open the dashboard login page.", url: "https://dashboard.example.com/login", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "fill", instruction: "Enter your email.", command: 'get_by_label("Email")', value: "{email}", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "fill", instruction: "Enter your password.", command: 'get_by_label("Password")', value: "{password}", sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "click", instruction: "Submit the login form.", command: 'get_by_role("button", name="Sign in")', sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
      { type: "wait", instruction: "Wait for the dashboard shell to load.", duration: 2, sleep_before: 0, skip_command: false, max_retries: 3 },
      { type: "click", instruction: "Open the account menu for this session.", command: 'locator("#menu-item-a83f21")', skip_command: true, sleep_before: 0, duration: 0, max_retries: 3 },
      { type: "click", instruction: "Open Billing.", command: 'get_by_role("menuitem", name="Billing")', sleep_before: 0, duration: 0, skip_command: false, max_retries: 3 },
    ],
  },
];
