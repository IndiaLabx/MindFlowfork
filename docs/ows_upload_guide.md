# One Word Substitution (OWS) Bulk Upload Guide for Admin Control Room

This guide provides the required JSON format, field constraints, and guidelines for generating valid OWS entries using Large Language Models (LLMs) to be bulk-uploaded into the Mindflow Admin Control Room.

## Required JSON Template

The Bulk Upload feature expects a **JSON Array of Objects** (`[]`). Each object must strictly follow the schema below. Note that `usage_sentences` is passed as a JSON array of strings.

```json
[
  {
    "v1_id": "",
    "word": "Atheist",
    "pos": "Noun",
    "meaning_english": "A person who disbelieves or lacks belief in the existence of God or gods.",
    "meaning_hindi": "नास्तिक",
    "usage_sentences": ["He is a committed atheist.", "The atheist refused to pray during the ceremony."],
    "source_pdf": "SSC CGL 2023",
    "exam_year": 2023,
    "difficulty": "Medium",
    "status": "active"
  }
]
```

## Field Guidelines

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `word` | String | **Yes** | The actual One Word Substitution word. |
| `pos` | String | **Yes** | The part of speech. Allowed values: `"Noun"`, `"Verb"`, `"Adjective"`, `"Adverb"`. |
| `meaning_english` | String | **Yes** | The English definition/meaning of the word. |
| `meaning_hindi` | String | **Yes** | The Hindi meaning/translation of the word. |
| `usage_sentences` | Array of Strings | **Yes** | An array of strings representing example sentences. (Will be stringified automatically on single form submission, but in bulk JSON, pass it as an actual JSON array of strings). |
| `source_pdf` | String | **Yes** | The origin of the OWS (e.g., "TCS PYQ", "SSC CGL 2023"). |
| `exam_year` | Number/String | **Yes** | The year the OWS appeared in the exam. The system will parse it into an integer. |
| `difficulty` | String | **Yes** | The difficulty level. Allowed values: `"Easy"`, `"Medium"`, `"Hard"`. The LLM should decide this. |
| `status` | String | **Yes** | The visibility status. Allowed values: `"active"`, `"draft"`. |
| `v1_id` | String | Optional | Used for legacy IDs if applicable. Leave as an empty string `""` if not used. |

---

## LLM Prompt Template for Generating OWS

You can use the following prompt to generate full fields for specific OWS using ChatGPT, Claude, or any other LLM.

**Prompt:**
> Please take the following list of words (One Word Substitutions) and populate all required fields for each.
> Keep in mind that the target audience is an Indian student preparing for the SSC CGL competitive exam. Use your best judgment to logically determine the difficulty level (Easy, Medium, or Hard) for each word based on this audience.
>
> Output the result **strictly** as a valid JSON array of objects, matching the exact structure below. Do not include any markdown formatting block ticks like \`\`\`json, just the raw JSON text.
>
> List of OWS words to process:
> 1. Atheist
> 2. [Add more words here...]
>
> Required JSON Object Structure for each word:
> {
>   "v1_id": "",
>   "word": "[The exact word provided]",
>   "pos": "[Choose from: Noun, Verb, Adjective, Adverb]",
>   "meaning_english": "[Clear English Meaning]",
>   "meaning_hindi": "[Accurate Hindi Meaning]",
>   "usage_sentences": ["[Example sentence 1]", "[Example sentence 2]"],
>   "source_pdf": "TCS PYQ",
>   "exam_year": 2023,
>   "difficulty": "[Easy, Medium, or Hard based on SSC CGL context]",
>   "status": "active"
> }

## Upload Instructions

1. Navigate to the **Admin Control Room** > **Upload OWS**.
2. Select the **Bulk Upload** mode.
3. Paste the generated JSON Array into the text area.
4. The system will automatically validate the JSON syntax. If valid, click **Check Validation & Duplicates**.
5. Review the new count versus skipped duplicates.
6. Click **Upload [N] Valid OWS** to insert them into the database.
