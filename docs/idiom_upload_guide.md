# Idiom Bulk Upload Guide for Admin Control Room

This guide provides the required JSON format, field constraints, and guidelines for generating valid idiom entries using Large Language Models (LLMs) to be bulk-uploaded into the Mindflow Admin Control Room.

## Required JSON Template

The Bulk Upload feature expects a **JSON Array of Objects** (`[]`). Each object must strictly follow the schema below.

```json
[
  {
    "v1_id": "",
    "phrase": "Bite the bullet",
    "meaning_english": "To endure a painful or otherwise unpleasant situation that is seen as unavoidable.",
    "meaning_hindi": "मुसीबत का सामना करना",
    "usage": "I hate going to the dentist, but I will just have to bite the bullet.",
    "mnemonic": "Imagine biting a bullet during surgery without anesthesia.",
    "source_pdf": "SSC CGL 2023",
    "exam_year": 2023,
    "difficulty": "Medium",
    "status": "active",
    "image_url": ""
  }
]
```

## Field Guidelines

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `phrase` | String | **Yes** | The actual idiom phrase. |
| `meaning_english` | String | **Yes** | The English meaning/explanation of the idiom. |
| `meaning_hindi` | String | **Yes** | The Hindi meaning/translation of the idiom. |
| `usage` | String | **Yes** | A practical example sentence using the idiom correctly. |
| `source_pdf` | String | **Yes** | The origin of the idiom (e.g., "TCS PYQ", "SSC CGL 2023"). |
| `exam_year` | Number/String | **Yes** | The year the idiom appeared in the exam. The system will parse it into an integer. |
| `difficulty` | String | **Yes** | The difficulty level. Allowed values: `"Easy"`, `"Medium"`, `"Hard"`. The LLM should decide this. |
| `status` | String | **Yes** | The visibility status. Allowed values: `"active"`, `"draft"`. |
| `mnemonic` | String | Optional | A memory trick or hint to help remember the idiom. |
| `v1_id` | String | Optional | Used for legacy IDs if applicable. Leave as an empty string `""` if not used. |
| `image_url` | String | Optional | URL to an associated image. Leave as an empty string `""` if not used. |

---

## LLM Prompt Template for Generating Idioms

You can use the following prompt to generate full fields for specific idioms using ChatGPT, Claude, or any other LLM.

**Prompt:**
> Please take the following list of idioms and populate all required fields for each.
> Keep in mind that the target audience is an Indian student preparing for the SSC CGL competitive exam. Use your best judgment to logically determine the difficulty level (Easy, Medium, or Hard) for each idiom based on this audience.
>
> Output the result **strictly** as a valid JSON array of objects, matching the exact structure below. Do not include any markdown formatting block ticks like \`\`\`json, just the raw JSON text.
>
> List of Idioms to process:
> 1. A diamond in the rough
> 2. [Add more idioms here...]
>
> Required JSON Object Structure for each idiom:
> {
>   "v1_id": "",
>   "phrase": "[The exact idiom provided]",
>   "meaning_english": "[Clear English Meaning]",
>   "meaning_hindi": "[Accurate Hindi Meaning]",
>   "usage": "[An example sentence using the idiom]",
>   "mnemonic": "[A creative memory trick to remember it]",
>   "source_pdf": "TCS PYQ",
>   "exam_year": 2023,
>   "difficulty": "[Easy, Medium, or Hard based on SSC CGL context]",
>   "status": "active",
>   "image_url": ""
> }

## Upload Instructions

1. Navigate to the **Admin Control Room** > **Upload Idioms**.
2. Select the **Bulk Upload** mode.
3. Paste the generated JSON Array into the text area.
4. The system will automatically validate the JSON syntax. If valid, click **Check Validation & Duplicates**.
5. Review the new count versus skipped duplicates.
6. Click **Upload [N] Valid Idioms** to insert them into the database.
