const form = document.querySelector('#quiz-form');
const answersList = document.querySelector('#answers-list');
const submitBtn = document.querySelector('#submit-btn');
const nextBtn = document.querySelector('#next-btn');
const numberEl = document.querySelector('#question-number');
const questionTextEl = document.querySelector('#question-text');
const progressText = document.querySelector('#progress-text');
const progressPercent = document.querySelector('#progress-percent');
const progressFill = document.querySelector('#progress-fill');
const loadingEl = document.querySelector('#loading');
const errorEl = document.querySelector('#error-message');
const refreshBtn = document.querySelector('#refresh-btn');

// Вмикає/вимикає індикатор завантаження та блокує кнопки.
function setLoading(isLoading) {
  loadingEl.hidden = !isLoading;
  refreshBtn.disabled = isLoading;
  submitBtn.disabled = isLoading || quizData.length === 0;
}

// Розкодовує HTML-сутності (&quot;, &#039; тощо) у звичайний текст.
function decodeHtml(text) {
  return new DOMParser().parseFromString(text, 'text/html').documentElement.textContent;
}

// Перемішує копію масиву.
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Перетворює results[] з API на формат, який очікує renderQuestion.
function mapResults(results) {
  return results.map((item) => {
    const correct = decodeHtml(item.correct_answer);
    const options = shuffle([correct, ...item.incorrect_answers.map(decodeHtml)]);
    return {
      question: decodeHtml(item.question),
      options,
      correctIndex: options.indexOf(correct)
    };
  });
}

let quizData = [];
const userAnswers = [];
let currentIndex = 0;

const API_URL = 'https://opentdb.com/api.php?amount=10&type=multiple';

async function loadData() {
  try {
    setLoading(true);
    errorEl.hidden = true;

    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Помилка HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    if (data.response_code !== 0) {
      throw new Error(`API повернув response_code ${data.response_code}`);
    }

    quizData = mapResults(data.results);
    currentIndex = 0;
    userAnswers.length = 0;
    form.reset();
    renderQuestion();
  }
  catch (error) {
    console.error('Не вдалося завантажити питання:', error);
    errorEl.textContent = 'Не вдалося завантажити питання. Перевірте інтернет-з’єднання та спробуйте ще раз.';
    errorEl.hidden = false;
  } finally {
    setLoading(false);
  }
}

loadData();

refreshBtn.addEventListener('click', loadData);

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