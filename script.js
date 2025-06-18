const whisperButton = document.getElementById('whisperButton');
const categorySelect = document.getElementById('category');
const foodSuggestion = document.getElementById('foodSuggestion');
const errorMessage = document.getElementById('errorMessage');

// Food list and categories
const foodList = {
    "Main Course": ["Pasta", "Chicken Sauté", "Lentil Soup", "Grilled Salmon", "Manti", "Meatballs"],
    "Dessert": ["Rice Pudding", "Creme Caramel", "Brownie", "Kazandibi", "Trileçe", "Profiterole"],
    "Breakfast": ["Omelette", "Pancakes", "Menemen", "Spread Breakfast", "Simit Poğaça", "Toast"],
    "International": ["Sushi", "Taco", "Pizza", "Hamburger", "Creamy Mushroom Chicken", "Noodles"]
};

let lastSuggestedFood = ""; // To prevent the same food from appearing consecutively

function getRandomFood() {
    errorMessage.textContent = ""; // Clear error message

    const selectedCategoryValue = categorySelect.value;
    let currentCategory;
    let availableFoods = [];

    // --- Flowchart Decision Point: Is category filter selected? ---
    if (selectedCategoryValue === "All Categories") {
        // NO branch: Pick a random food category
        const categories = Object.keys(foodList);
        currentCategory = categories[Math.floor(Math.random() * categories.length)];
        availableFoods = foodList[currentCategory];
    } else {
        // YES branch: Filter by user selected category
        currentCategory = selectedCategoryValue;
        availableFoods = foodList[currentCategory];
    }

    // --- Flowchart Decision Point: Is the food list for the selected category empty? ---
    if (!availableFoods || availableFoods.length === 0) {
        foodSuggestion.textContent = ""; // Clear previous suggestion
        errorMessage.textContent = "No food found in this category. Please select another category.";
        lastSuggestedFood = ""; // Reset last suggestion on error
        return; // Exit function
    }

    let randomIndex;
    let newSuggestion;

    // --- Flowchart Logic: Loop to prevent the same food from appearing consecutively ---
    // If there's more than one food in the list and the new suggestion is the same as the last, pick again.
    do {
        randomIndex = Math.floor(Math.random() * availableFoods.length);
        newSuggestion = availableFoods[randomIndex];
    } while (newSuggestion === lastSuggestedFood && availableFoods.length > 1); 

    foodSuggestion.textContent = newSuggestion; // Display the new suggestion
    lastSuggestedFood = newSuggestion; // Update the last suggested food
}

// Event Listeners (Wait for User Input)
whisperButton.addEventListener('click', getRandomFood);
categorySelect.addEventListener('change', getRandomFood); // Whisper a new food when category changes

// Whisper the first random food when the application loads
getRandomFood();
