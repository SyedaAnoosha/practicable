import re
import json

def parse_markdown_to_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by question headers
    questions = re.split(r'\n### (Q\d+)', content)[1:]  # Skip first empty element
    
    # Pair up (id, content)
    question_pairs = [(questions[i], questions[i+1]) for i in range(0, len(questions), 2)]
    
    result = []
    
    for q_id, q_content in question_pairs:
        # Extract question title
        title_match = re.search(r'— (.+)', q_content)
        title = title_match.group(1).strip() if title_match else ""
        
        # Extract the table - find the table section and parse it
        tags = {}
        lines = q_content.split('\n')
        table_start = -1
        for i, line in enumerate(lines):
            if '| Tag | Value |' in line:
                table_start = i
                break
        
        if table_start >= 0:
            # Parse table rows (skip header and separator)
            for i in range(table_start + 2, len(lines)):
                line = lines[i].strip()
                if line == '' or not line.startswith('|'):
                    break
                parts = [p.strip() for p in line.split('|')]
                if len(parts) >= 3:
                    tag_key = parts[1].lower().replace(' ', '_')
                    tags[tag_key] = parts[2]
        
        # Extract plain-language question
        plain_match = re.search(r'\*\*Plain-language question:\*\* (.+)', q_content)
        description = plain_match.group(1).strip() if plain_match else ""
        
        # Extract answer
        answer_match = re.search(r'\*\*Answer:\*\*\n\n(.+?)(?=\n---|\Z)', q_content, re.DOTALL)
        answer = answer_match.group(1).strip() if answer_match else ""
        # Clean up answer - remove extra whitespace and newlines
        answer = ' '.join(answer.split())
        
        # Get domain from tags
        domain = tags.get('domain', '')
        
        # Create the JSON object
        json_obj = {
            "id": int(q_id[1:]),  # Extract number from Q001
            "question": title,
            "description": description,
            "domain": domain,
            "tags": {
                "effort": tags.get('effort', ''),
                "duration": tags.get('duration', ''),
                "tier": tags.get('tier', ''),
                "cost": tags.get('cost', ''),
                "roi_horizon": tags.get('roi_horizon', ''),
                "reg_pressure": tags.get('regulator_pressure', ''),
                "leadership_traits": tags.get('leadership_traits', '')
            },
            "answer": answer
        }
        
        result.append(json_obj)
    
    return result

# Parse the file
file_path = r'c:\Users\PMYLS\Downloads\Effective-Risk-Management-Work\Deciding-In-The-Dark-Platform\docs\Deciding_in_the_Dark_100_Questions.md'
questions_json = parse_markdown_to_json(file_path)

# Save to JSON
output_path = r'c:\Users\PMYLS\Downloads\Effective-Risk-Management-Work\Deciding-In-The-Dark-Platform\docs\questions.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(questions_json, f, indent=2)

print(f"Successfully parsed {len(questions_json)} questions to {output_path}")
