



import { GoogleGenAI, Type } from "@google/genai";
import type { ActivePlayer, Character, NPC } from '../types';
import { isApiKeyAvailable } from "../utils/apiKey";

const ai = isApiKeyAvailable ? new GoogleGenAI({ apiKey: process.env.API_KEY! }) : null;

if (!ai) {
    console.warn("API_KEY environment variable not set. Gemini API features are disabled.");
}

const textModel = 'gemini-2.5-flash';
const imageModel = 'imagen-3.0-generate-002';


export const generateSceneryImage = async (pageContent: string, recentNarration: string) => {
    if (!ai) {
        throw new Error("AI features are disabled: API key is not configured.");
    }
    const fullPrompt = `
Generate an image extremely quickly for a Dungeons and Dragons game. Speed is more important than quality or accuracy.
The style should be a very simple, fast digital sketch, It should look like you're watching a page from an old book.
Do not include any characters, UI elements, or text on the image.

The main subject of the image is based on the most recent event: "${recentNarration}"

Use the following story text for additional context about the location and mood, but you must focus on depicting the recent event:
---
${pageContent}
---
`.trim();

    try {
        const response = await ai.models.generateImages({
            model: imageModel,
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg', // Use JPEG for smaller file size
                aspectRatio: '16:9',
            },
        });
        return response.generatedImages[0].image.imageBytes;
    } catch(e) {
        console.error("Error generating scenery:", e);
        throw new Error("The muses of creation are silent. Could not generate the scene.");
    }
};


const CHARACTER_SHEET_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The character's first name." },
        race: { type: Type.STRING, description: "The character's race (e.g., Human, Elf, Dwarf)." },
        class: { type: Type.STRING, description: "The character's class (e.g., Fighter, Wizard, Rogue)." },
        age: { type: Type.INTEGER, description: "The character's age in years." },
        level: { type: Type.INTEGER, description: "The character's level. This should start at 1." },
        experience: {
            type: Type.OBJECT,
            description: "The character's experience points. Should be 0 out of 300 for a new level 1 character.",
            properties: {
                current: { type: Type.INTEGER },
                nextLevel: { type: Type.INTEGER }
            },
            required: ["current", "nextLevel"]
        },
        health: {
            type: Type.OBJECT,
            description: "The character's health points. Max health should be based on class (e.g., Wizard: 10, Fighter: 15). Current should equal max.",
            properties: {
                current: { type: Type.INTEGER },
                max: { type: Type.INTEGER }
            },
            required: ["current", "max"]
        },
        stamina: {
            type: Type.OBJECT,
            description: "The character's stamina points, from 0 to 100. It should always start at 100 for a new character. Max should be 100.",
            properties: {
                current: { type: Type.INTEGER },
                max: { type: Type.INTEGER }
            },
            required: ["current", "max"]
        },
        resource: {
            type: Type.OBJECT,
            description: "An optional resource pool like Mana for magic users or Stamina for martial characters. Not all classes have this. Example: { name: 'Mana', current: 20, max: 20 }.",
            properties: {
                name: { type: Type.STRING },
                current: { type: Type.INTEGER },
                max: { type: Type.INTEGER }
            },
            required: ["name", "current", "max"]
        },
        stats: {
            type: Type.OBJECT,
            properties: {
                strength: { type: Type.INTEGER, description: "A value from 3-20 representing physical power." },
                intelligence: { type: Type.INTEGER, description: "A value from 3-20 representing reasoning and memory." },
                charisma: { type: Type.INTEGER, description: "A value from 3-20 representing force of personality." },
            },
            required: ["strength", "intelligence", "charisma"]
        },
        skills: {
            type: Type.ARRAY,
            description: "A list of 2-3 key skills, each with a name and a detailed description of its effect, duration, or mechanics.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the skill (e.g., 'Fireball', 'Stealth')." },
                    description: { type: Type.STRING, description: "A mechanical description of the skill (e.g., 'Deals 2d6 fire damage to a target.', 'Become invisible for 30 seconds while not attacking.')." }
                },
                required: ["name", "description"]
            }
        },
        personalityTraits: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of 2-4 single-word personality traits (e.g., 'Brave', 'Clumsy', 'Sarcastic')."
        },
        fears: {
            type: Type.STRING,
            description: "A short sentence describing the character's greatest fear (e.g., 'Deep water and what lurks within.')."
        },
        backstory: {
            type: Type.STRING,
            description: "A concise, one-paragraph summary of the character's history and motivation, rewritten from the user's input."
        },
        inventory: {
            type: Type.ARRAY,
            description: "A list of 1-3 starting inventory items with names and quantities, appropriate for the character's class.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the item (e.g., 'Health Potion')." },
                    quantity: { type: Type.INTEGER, description: "The number of this item the character possesses." }
                },
                required: ["name", "quantity"]
            }
        },
    },
    required: ["name", "race", "class", "age", "level", "experience", "health", "stamina", "stats", "skills", "personalityTraits", "fears", "backstory", "inventory"]
};

const getCharacterCreationPrompt = (backstory: string, refinement?: string, existingCharacter?: string) => {
    let prompt = `You are a creative assistant for a Dungeons & Dragons game. Your task is to generate a detailed character sheet based on a player's submitted backstory.
    The response MUST be a valid JSON object matching the provided schema.
    Generate balanced stats between 8 and 18.
    The character must start at level 1 with 0 experience points.
    Infer all character details from the backstory, including name, race, class, personality, fears, and skills.
    - Health: Give a reasonable starting max health based on class (Wizards are frail, Fighters are tough). Current health should equal max health.
    - Stamina: This represents physical endurance. It must start at 100/100 for a new character.
    - Resource: If the class uses a resource like Mana or Stamina, include the 'resource' object. Otherwise, omit it.
    - Skills: For each skill, provide a name and a concrete mechanical description (e.g., duration, effect, cost).
    - Inventory: Provide 1-3 appropriate starting items with quantities.

    Player's backstory:
    ---
    ${backstory}
    ---
    `;

    if (refinement && existingCharacter) {
        prompt += `The Dungeon Master has reviewed the previously generated character and has provided refinement notes.
        Update the character sheet based on these notes.

        Previously Generated Character (JSON):
        ${existingCharacter}

        DM's Refinement Notes:
        ${refinement}
        
        Generate the new, updated, and complete character sheet as a single JSON object.`;
    } else {
        prompt += "Generate the character sheet as a JSON object.";
    }

    return prompt;
};

export const createCharacterFromBackstory = async (backstory: string, refinement?: string, existingCharacterJSON?: string): Promise<string> => {
    if (!ai) {
        throw new Error("AI features are disabled: API key is not configured.");
    }
    try {
        const prompt = getCharacterCreationPrompt(backstory, refinement, existingCharacterJSON);
        const response = await ai.models.generateContent({
            model: textModel,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: CHARACTER_SHEET_SCHEMA
            }
        });
        
        return response.text;
    } catch (error) {
        console.error("Error creating character from backstory:", error);
        throw new Error("The AI failed to shape the hero's destiny. Please try again.");
    }
};

export const generatePixelArtAvatar = async (character: Character, refinement?: string) => {
    if (!ai) {
        throw new Error("AI features are disabled: API key is not configured.");
    }

    const prompt = `
Create a single, full-body 16-bit pixel art character sprite of a Dungeons and Dragons character. The style should be clean and well-defined, reminiscent of classic 16-bit JRPGs.

The character is ${character.name}, a level ${character.level} ${character.race} ${character.class}.
- **Personality:** ${character.personalityTraits.join(', ')}.
- **Greatest Fear:** ${character.fears}
- **Description for Visuals:** ${character.backstory}
${refinement ? `\n**DM's Refinement Instructions:** ${refinement}\n` : ''}

Use the personality, fear, and description to influence the character's posture, expression, and overall mood. For example, a 'Brave' character might stand tall, while a 'Clumsy' one might look slightly off-balance.

**CRITICAL OUTPUT RULES:**
1.  **TRANSPARENT BACKGROUND:** The background MUST be fully transparent. The output must be a PNG file with an alpha channel. Do not include any colors, shapes, or scenery in the background.
2.  **NO TEXT:** Do NOT render any text, letters, or numbers on the image itself. The output should only be the character sprite.
3.  **COMPOSITION:** The character should be standing, centered, and fully visible in a square frame.
`.trim();

    try {
        const response = await ai.models.generateImages({
            model: imageModel,
            prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            }
        });
        return response.generatedImages[0].image.imageBytes;
    } catch(e) {
        console.error("Error generating avatar:", e);
        throw new Error("The muses of creation are silent. Could not generate avatar.");
    }
};

export const createNpcFromDescription = async (description: string): Promise<string> => {
    if (!ai) {
        throw new Error("AI features are disabled: API key is not configured.");
    }
    const prompt = `You are a creative assistant for a Dungeons & Dragons game. Your task is to generate a character sheet for a Non-Player Character (NPC) based on a description.
    The response MUST be a valid JSON object matching the provided schema.
    Generate stats appropriate for the NPC's role (e.g., a simple shopkeeper may have low stats, a guard may have higher strength).
    The NPC can be any level, inferred from the description.
    Infer all character details from the description. For NPCs, some fields like skills or resources can be sparse or empty if not applicable (e.g., an empty skills array []).
    
    NPC Description:
    ---
    ${description}
    ---
    Generate the character sheet as a JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: textModel,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: CHARACTER_SHEET_SCHEMA
            }
        });
        
        return response.text;
    } catch (error) {
        console.error("Error creating NPC from description:", error);
        throw new Error("The AI failed to shape the NPC's destiny. Please try again.");
    }
};

export const generateMapImage = async (mapPrompt: string) => {
    if (!ai) {
        throw new Error("AI features are disabled: API key is not configured.");
    }

    const fullPrompt = `
Generate a top-down 2D battle map for a Dungeons and Dragons game.
The style should be a thematic, slightly painterly but clear, and fit for a fantasy setting.
The scene described is: "${mapPrompt}".
The image must be from a direct top-down perspective, like a blueprint.
Ensure the details are clear enough to be used as a game board for character tokens.
Do not include any text, grids, or UI elements on the image.
`.trim();

    try {
        const response = await ai.models.generateImages({
            model: imageModel,
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9',
            },
        });
        return response.generatedImages[0].image.imageBytes;
    } catch(e) {
        console.error("Error generating map:", e);
        throw new Error("The cartographers of the ether are busy. Could not generate map.");
    }
};


const DM_ASSISTANT_RESPONSE_SCHEMA = {
    type: Type.ARRAY,
    description: "An array of update actions to perform on one or more characters.",
    items: {
        type: Type.OBJECT,
        properties: {
            playerName: {
                type: Type.STRING,
                description: "The name of the character to be updated. This MUST exactly match one of the provided character names."
            },
            level: { type: Type.INTEGER, description: "The character's new level." },
            experience: {
                type: Type.OBJECT,
                description: "The character's new experience points. Include only fields being changed.",
                properties: {
                    current: { type: Type.INTEGER },
                    nextLevel: { type: Type.INTEGER }
                }
            },
            health: {
                type: Type.OBJECT,
                description: "The character's new health. Include only fields being changed (e.g., 'current' for taking damage).",
                properties: {
                    current: { type: Type.INTEGER },
                    max: { type: Type.INTEGER }
                }
            },
            stamina: {
                type: Type.OBJECT,
                description: "The character's new stamina. Include only fields being changed.",
                properties: {
                    current: { type: Type.INTEGER },
                    max: { type: Type.INTEGER }
                }
            },
            resource: {
                type: Type.OBJECT,
                description: "The character's new resource values. Include only fields being changed.",
                properties: {
                    name: { type: Type.STRING },
                    current: { type: Type.INTEGER },
                    max: { type: Type.INTEGER }
                }
            },
            age: { type: Type.INTEGER, description: "The character's new age." },
            stats: {
                type: Type.OBJECT,
                description: "An object with the character's new stats. Only include the specific stats that are changing.",
                properties: {
                    strength: { type: Type.INTEGER },
                    intelligence: { type: Type.INTEGER },
                    charisma: { type: Type.INTEGER },
                }
            },
            backstory: {
                type: Type.STRING,
                description: "The character's new, complete backstory."
            },
            inventory: {
                type: Type.ARRAY,
                description: "The character's new, complete inventory list with items and quantities.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        quantity: { type: Type.INTEGER }
                    },
                    required: ["name", "quantity"]
                }
            },
            skills: {
                type: Type.ARRAY,
                description: "The character's new, complete list of skills with names and descriptions.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING }
                    },
                    required: ["name", "description"]
                }
            },
            personalityTraits: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The character's new, complete list of personality traits."
            },
            fears: {
                type: Type.STRING,
                description: "The character's new, complete text for their fears."
            },
            avatarRefinement: {
                type: Type.STRING,
                description: "If the DM asks to change a character's avatar, provide a prompt describing the changes here."
            }
        },
        required: ["playerName"]
    }
};


export const executeDMAssistantCommand = async (command: string, players: ActivePlayer[], visibleNpcs: NPC[]): Promise<string> => {
    if (!ai) {
        throw new Error("AI features are disabled: API key is not configured.");
    }
    if (players.length === 0 && visibleNpcs.length === 0) {
      throw new Error("There are no characters on the map to modify.");
    }

    const playerContext = players.map(p => p.character_data);
    const npcContext = visibleNpcs.map(n => n.character_data);

    const prompt = `You are a Dungeon Master's assistant. Your task is to process a command from the DM to modify character sheets for players and NPCs currently on the map.
The response MUST be a valid JSON object that is an ARRAY of update actions, matching the provided schema.
You can process multiple actions in a single command (e.g., one player takes damage, an NPC gets an item).
You must intelligently handle additive, subtractive, and replacement commands for all stats.

**For inventory changes:**
- When adding items (e.g., "give Elara 5 healing potions"), you MUST read the character's existing inventory.
- If the item exists, update its quantity.
- If it does not exist, add it as a new item.
- When removing items (e.g., "Grizelda uses a health potion"), you must decrease the quantity. If the quantity becomes 0 or less, REMOVE the item from the inventory array entirely.
- The 'inventory' field in your response must be the character's NEW, COMPLETE inventory list.

Current Characters on the Map:
---
**Players:**
${JSON.stringify(playerContext, null, 2)}

**Visible NPCs:**
${JSON.stringify(npcContext, null, 2)}
---

Dungeon Master's Command:
---
${command}
---

Based on the command, generate a JSON array of update objects.
Each object in the array requires a 'playerName' field matching a name from the lists above.
Include ONLY the top-level keys for the fields that are being updated.
For nested objects like 'health' or 'stats', include only the sub-keys that are changing.

Example Command: "Elara takes 10 damage, her stamina drops to 50, and the Goblin Archer is frightened."
Example Response (assuming Elara's health was 12 and Goblin Archer is an NPC):
[
  { "playerName": "Elara", "health": { "current": 2 }, "stamina": { "current": 50 } },
  { "playerName": "Goblin Archer", "fears": "Is now terrified of Elara." }
]`;

    try {
        const response = await ai.models.generateContent({
            model: textModel,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: DM_ASSISTANT_RESPONSE_SCHEMA
            }
        });
        return response.text;
    } catch (error) {
        console.error("Error executing DM assistant command:", error);
        throw new Error("The assistant misunderstood your command. Please be more specific.");
    }
};