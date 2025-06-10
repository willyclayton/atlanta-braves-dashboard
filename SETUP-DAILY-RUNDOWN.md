# Daily Rundown Setup Instructions

The Daily Rundown feature automatically generates AI-powered summaries of the Atlanta Braves' recent games and notable developments. Here's how to set it up:

## Prerequisites

1. An OpenAI API account with access to GPT-3.5-turbo
2. GitHub repository with Actions enabled

## Setup Steps

### 1. Get OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (you won't be able to see it again)

### 2. Add GitHub Secret
1. Go to your repository on GitHub
2. Click on "Settings" tab
3. Click on "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Name: `OPENAI_API_KEY`
6. Value: Paste your OpenAI API key
7. Click "Add secret"

### 3. Enable GitHub Actions (if not already enabled)
1. Go to the "Actions" tab in your repository
2. If prompted, click "I understand my workflows, go ahead and enable them"

## How It Works

- **Schedule**: Runs daily at 4:00 AM EST (9:00 AM UTC)
- **Process**: 
  1. Fetches recent Braves games from MLB API
  2. Sends game data to OpenAI API with a specialized prompt
  3. Saves the AI-generated rundown to `data/daily-rundown.json`
  4. Commits the file to your repository
- **Display**: Your website automatically loads and displays the content

## Manual Trigger

You can manually trigger the workflow:
1. Go to Actions tab in your repository
2. Click on "Daily Rundown" workflow
3. Click "Run workflow" button
4. Click the green "Run workflow" button

## Fallback

If the API calls fail, the system will display a friendly fallback message instead of breaking the site.

## Cost Considerations

- OpenAI API calls are very inexpensive for this use case
- Estimated cost: ~$0.01-0.03 per day (depending on content length)
- You can monitor usage in your OpenAI dashboard

## Troubleshooting

1. **No content updating**: Check the Actions tab for failed workflows
2. **API errors**: Verify your OpenAI API key is valid and has credits
3. **File not found**: Ensure the workflow has write permissions to the repository

The initial content will show a welcome message until the first automated run completes. 