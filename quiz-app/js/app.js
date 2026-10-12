console.log('script.js підключено')

const quizData = [
    { question: "Яка столиця України?", answer: "Київ" },
    { question: "Скільки днів у високосному році?", answer: "366" },
    { question: "Яка планета найбільша в Сонячній системі?", answer: "Юпітер" }
]

const userAnswers = ["Київ", "365", "Юпітер"];

// Функція виводить усі питання вікторини у консоль за допомогою циклу for...of
function displayQuestions(questions) {
    console.log("Список питань вікторини");
    for (const item of questions) {
        console.log(`Питання: ${item.question}`);
    }
}

// Функція порівнює відповіді користувача з правильними та класифікує їх
function checkAnswers(questions, userAns) {
    let correctCount = 0;

    console.log("Результати перевірки відповідей");
    for (let i = 0; i < questions.length; i++) {
        if (userAns[i].toLowerCase() === questions[i].answer.toLowerCase()) {
            console.log(`Питання ${i + 1}: «правильно»`);
            correctCount++;
        } else {
            console.log(`Питання ${i + 1}: «неправильно»`);
        }
    }

    return correctCount;
}

// Стрілкова функція для обчислення відсотка успішності квізу
const calcScorePercent = (correctCount, total) => Math.round((correctCount / total) * 100);

displayQuestions(quizData);
const correctTotal = checkAnswers(quizData, userAnswers);
const scorePercent = calcScorePercent(correctTotal, quizData.length);

console.log(`Загальна кількість правильних відповідей: ${correctTotal} з ${quizData.length}`);
console.log(`Ваш результат: ${scorePercent}%`);