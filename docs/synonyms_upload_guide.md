# Synonyms Bulk Upload Guide for Admin Control Room

This guide provides the required JSON format, field constraints, and guidelines for generating valid synonym entries using Large Language Models (LLMs) to be bulk-uploaded into the Mindflow Admin Control Room.

## Required JSON Template

The Bulk Upload feature expects a **JSON Array of Objects** (`[]`). Each object must strictly follow the schema below. Several fields such as `synonyms`, `antonyms`, and `confusable_with` are passed as JSON arrays of strings.

```json
[
  {
    "word": "Abundant",
    "pos": "Adjective",
    "theme": "Quantity",
    "cluster_id": "",
    "meaning": "Existing or available in large quantities; plentiful.",
    "hindi_meaning": "प्रचुर",
    "synonyms": ["plentiful", "copious", "ample"],
    "antonyms": ["scarce", "sparse"],
    "confusable_with": ["Abandoned"],
    "importance_score": 85,
    "lifetime_frequency": 0,
    "recent_trend": 0,
    "repetition_raw": ""
  }
]
```

## Field Guidelines

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `word` | String | **Yes** | The core vocabulary word. |
| `pos` | String | **Yes** | The part of speech. Allowed values: `"Noun"`, `"Verb"`, `"Adjective"`, `"Adverb"`. |
| `meaning` | String | **Yes** | The English definition/meaning of the word. |
| `hindi_meaning` | String | **Yes** | The Hindi meaning/translation of the word. |
| `synonyms` | Array of Strings | **Yes** | An array of synonym strings (e.g., `["plentiful", "copious"]`). |
| `antonyms` | Array of Strings | **Yes** | An array of antonym strings (e.g., `["scarce", "sparse"]`). |
| `theme` | String | **Yes** | The categorization theme (e.g., `"Quantity"`, `"General"`). Default is `"General"`. |
| `importance_score` | Number/String | **Yes** | Score representing importance (e.g., `85`). The LLM should decide this based on exam relevance. |
| `cluster_id` | String | Optional | Grouping ID for related words. |
| `confusable_with` | Array of Strings | Optional | Words it can be confused with. |
| `lifetime_frequency` | Number/String | Optional | Number indicating frequency. Default `0`. |
| `recent_trend` | Number/String | Optional | Number indicating trend. Default `0`. |
| `repetition_raw` | String | Optional | Raw repetition data if applicable. |

---

## LLM Prompt Template for Generating Synonyms

You can use the following prompt to generate full fields for specific vocabulary words using ChatGPT, Claude, or any other LLM.

**Prompt:**
> Please take the following list of vocabulary words and populate all required fields for each.
> Keep in mind that the target audience is an Indian student preparing for the SSC CGL competitive exam. Use your best judgment to logically determine the importance_score (0-100) for each word based on how frequently and importantly it appears in this context.
>
> Output the result **strictly** as a valid JSON array of objects, matching the exact structure below. Do not include any markdown formatting block ticks like \`\`\`json, just the raw JSON text.
>
> List of Vocabulary words to process:
> 1. Abundant
> 2. [Add more words here...]
>
> Required JSON Object Structure for each word:
> {
>   "word": "[The exact vocabulary word provided]",
>   "pos": "[Choose from: Noun, Verb, Adjective, Adverb]",
>   "theme": "[A general theme like: Emotion, Quantity, Time, General, etc.]",
>   "cluster_id": "",
>   "meaning": "[Clear English Meaning]",
>   "hindi_meaning": "[Accurate Hindi Meaning]",
>   "synonyms": ["[Synonym 1]", "[Synonym 2]", "[Synonym 3]"],
>   "antonyms": ["[Antonym 1]", "[Antonym 2]"],
>   "confusable_with": [],
>   "importance_score": [0-100 based on SSC CGL relevance],
>   "lifetime_frequency": 0,
>   "recent_trend": 0,
>   "repetition_raw": ""
> }

## Upload Instructions

1. Navigate to the **Admin Control Room** > **Upload Synonyms**.
2. Select the **Bulk Upload** mode.
3. Paste the generated JSON Array into the text area.
4. The system will automatically validate the JSON syntax. If valid, click **Check Validation & Duplicates**.
5. Review the new count versus skipped duplicates.
6. Click **Upload [N] Valid Synonyms** to insert them into the database.
