const quizData = [
  { question: "Яка столиця України?",
    options: ["Київ", "Львів", "Одеса", "Харків"], correctIndex: 0 },
  { question: "Скільки днів у високосному році?",
    options: ["365", "366", "364", "367"], correctIndex: 1 },
  { question: "Яка планета найбільша в Сонячній системі?",
    options: ["Марс", "Земля", "Юпітер", "Сатурн"], correctIndex: 2 }
];
 
const userAnswers = [];
let currentIndex = 0;
 
const form = document.querySelector('#quiz-form');
const answersList = document.querySelector('#answers-list');
const submitBtn = document.querySelector('#submit-btn');
const nextBtn = document.querySelector('#next-btn');
const numberEl = document.querySelector('#question-number');
const questionTextEl = document.querySelector('#question-text');
const progressText = document.querySelector('#progress-text');
const progressPercent = document.querySelector('#progress-percent');
const progressFill = document.querySelector('#progress-fill');

// Малює поточне питання, radio-варіанти та прогрес.
function renderQuestion() {
  const q = quizData[currentIndex];
 
  numberEl.textContent = String(currentIndex + 1).padStart(2, '0');
  questionTextEl.textContent = q.question;
  answersList.innerHTML = '';
 
  q.options.forEach((text, i) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'answer-btn';
    label.htmlFor = `answer-${i}`;
 
    const input = document.createElement('input');
    input.type = 'radio';
    input.id = `answer-${i}`;
    input.name = 'answer';
    input.value = i;
    input.required = true;
 
    const span = document.createElement('span');
    span.className = 'answer-text';
    span.textContent = text;
 
    label.append(input, span);
    li.append(label);
    answersList.append(li);
  });
 
  const percent = Math.round((currentIndex / quizData.length) * 100);
  progressText.textContent = `Питання ${currentIndex + 1} з ${quizData.length}`;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
 
  submitBtn.hidden = false;
  nextBtn.hidden = true;
}
 
renderQuestion();

// Обробка відправки форми.
form.addEventListener('submit', (event) => {
  event.preventDefault();

  const checked = form.querySelector('input[name="answer"]:checked');
  const chosenIndex = Number(checked.value);
  const correctIndex = quizData[currentIndex].correctIndex;
  const isCorrect = chosenIndex === correctIndex;

  userAnswers.push({ questionIndex: currentIndex, chosenIndex, isCorrect });

  const labels = answersList.querySelectorAll('.answer-btn');
  labels.forEach((label) => {
    label.querySelector('input').disabled = true;
  });
 
  labels[chosenIndex].classList.add(isCorrect ? 'is-correct' : 'is-error');
  labels[chosenIndex].insertAdjacentHTML('beforeend',
    `<span class="a11y-indicator">${isCorrect ? '✓ Правильно' : '✗ Помилка'}</span>`);
  if (!isCorrect) {
    labels[correctIndex].classList.add('is-correct');
  }
 
  submitBtn.hidden = true;
  nextBtn.hidden = false;
});

// Клік по «Наступне питання»: скидає форму й перемикає питання.
nextBtn.addEventListener('click', () => {
  form.reset();
 
  if (currentIndex < quizData.length - 1) {
    currentIndex++;
  } else {
    currentIndex = 0;
    userAnswers.length = 0;
  }
  renderQuestion();
});