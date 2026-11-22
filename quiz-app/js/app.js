// Фреймворк: React 18 (через CDN). Обрано, бо рендер списку робиться звичайним
// map() у JSX, без окремого синтаксису шаблонів, і працює без збірки та Node.js.

const { useState, useEffect, useRef } = React;

const API_URL = 'https://opentdb.com/api.php?amount=10&type=multiple';

// Час на відповідь (секунди) залежно від складності питання з API.
const TIME_BY_DIFFICULTY = { easy: 15, medium: 20, hard: 25 };
const TIMER_SIZE = 120;

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

// Перетворює results[] з API на формат { id, question, options, correctIndex, timeLimit }.
function mapResults(results) {
  return results.map((item, index) => {
    const correct = decodeHtml(item.correct_answer);
    const options = shuffle([correct, ...item.incorrect_answers.map(decodeHtml)]);
    return {
      id: index,
      question: decodeHtml(item.question),
      options,
      correctIndex: options.indexOf(correct),
      difficulty: item.difficulty,
      timeLimit: TIME_BY_DIFFICULTY[item.difficulty] || 20
    };
  });
}

// Малює один кадр таймера: трек, дуга, що зменшується, і число секунд.
function drawTimer(ctx, remaining, duration) {
  const center = TIMER_SIZE / 2;
  const radius = 48;
  const fraction = remaining / duration;
  const start = -Math.PI / 2;

  ctx.clearRect(0, 0, TIMER_SIZE, TIMER_SIZE);
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#f3e8ff';
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (fraction > 0) {
    ctx.strokeStyle = remaining <= 5 ? '#b91c1c' : '#5b21b6';
    ctx.beginPath();
    ctx.arc(center, center, radius, start, start + fraction * Math.PI * 2);
    ctx.stroke();
  }

  // Число секунд у центрі
  ctx.fillStyle = '#1e1b4b';
  ctx.font = '800 28px Nunito, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.ceil(remaining)), center, center);
}

// Canvas-таймер: цикл requestAnimationFrame працює, поки running === true.
function TimerCanvas({ duration, running, onTimeout }) {
  const canvasRef = useRef(null);
  const remainingRef = useRef(duration);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;
  const dpr = window.devicePixelRatio || 1;

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let rafId = null;
    let last = null;

    function frame(now) {
      if (last === null) last = now;
      const dt = Math.min(now - last, 100) / 1000;
      last = now;

      remainingRef.current = Math.max(0, remainingRef.current - dt);
      drawTimer(ctx, remainingRef.current, duration);

      if (remainingRef.current === 0) {
        onTimeoutRef.current();
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    drawTimer(ctx, remainingRef.current, duration);
    if (running) rafId = requestAnimationFrame(frame);

    // Зупинка циклу: відповідь, перехід до наступного питання, вихід з екрана
    return () => cancelAnimationFrame(rafId);
  }, [running, duration]);

  return (
    <div className="timer-wrap">
      <canvas
        ref={canvasRef}
        width={TIMER_SIZE * dpr}
        height={TIMER_SIZE * dpr}
        style={{ width: TIMER_SIZE, height: TIMER_SIZE }}
        role="img"
        aria-label="Таймер відповіді"
      />
    </div>
  );
}

// Дочірній компонент: дані лише через props, без глобальних змінних.
function QuizQuestion({ question, options, correctIndex, selectedIndex, onAnswer }) {
  const answered = selectedIndex !== null;

  return (
    <>
      <p className="question-text">{question}</p>
      <ul className="answers-list">
        {options.map((text, i) => {
          let className = 'answer-btn';
          if (answered && i === correctIndex) className += ' is-correct';
          else if (answered && i === selectedIndex) className += ' is-error';

          return (
            <li key={text}>
              <button
                type="button"
                className={className}
                disabled={answered}
                onClick={() => onAnswer(i)}
              >
                <span className="answer-text">{text}</span>
                {answered && i === selectedIndex && (
                  <span className="a11y-indicator">
                    {i === correctIndex ? '✓ Правильно' : '✗ Помилка'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// Список найкращих результатів: сортування масиву з getAllItems на клієнті.
function ResultsList({ results, error }) {
  const best = [...results]
    .sort((a, b) => b.score / b.total - a.score / a.total || new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <section id="results">
      <h2>Найкращі результати</h2>
      {error && <p className="status status-error" role="alert">{error}</p>}
      {!error && best.length === 0 && (
        <p className="status">Поки що немає збережених результатів.</p>
      )}
      <ul className="results-grid">
        {best.map((r, i) => (
          <li key={r.id}>
            <article className="card">
              <div>
                <h3>№{i + 1}</h3>
                <p className="date">Дата: {new Date(r.date).toLocaleDateString('uk-UA')}</p>
              </div>
              <p className="badge">Результат: {r.score}/{r.total}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Батьківський компонент: увесь реактивний стан вікторини.
function App() {
  const [quizData, setQuizData] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [dbError, setDbError] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error(`Помилка HTTP: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
      if (data.response_code !== 0) {
        throw new Error(`API повернув response_code ${data.response_code}`);
      }

      setQuizData(mapResults(data.results));
      setCurrentIndex(0);
      setUserAnswers([]);
      setScore(0);
    } catch (err) {
      console.error('Не вдалося завантажити питання:', err);
      setError('Не вдалося завантажити питання. Перевірте інтернет-з’єднання та спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  }

  // Читає всі результати з IndexedDB і кладе їх у стан.
  async function refreshResults() {
    try {
      setResults(await getAllItems());
      setDbError('');
    } catch (err) {
      console.error('IndexedDB недоступна:', err);
      setDbError('Не вдалося працювати зі сховищем результатів. Можливо, IndexedDB недоступна (наприклад, у приватному режимі).');
    }
  }

  // Зберігає результат завершеного квізу й оновлює список.
  async function saveResult(finalScore) {
    try {
      await addItem({ date: new Date().toISOString(), score: finalScore, total: quizData.length });
      await refreshResults();
    } catch (err) {
      console.error('Не вдалося зберегти результат:', err);
      setDbError('Не вдалося зберегти результат у сховищі.');
    }
  }

  useEffect(() => {
    loadData();
    (async () => {
      try {
        await migrateFromLocalStorage();
      } catch (err) {
        console.error('Міграція з localStorage не вдалася:', err);
      }
      await refreshResults();
    })();
  }, []);

  const total = quizData.length;
  const current = quizData[currentIndex];
  const currentAnswer = userAnswers.find(a => a.questionIndex === currentIndex);
  const selectedIndex = currentAnswer ? currentAnswer.chosenIndex : null;
  const answered = currentAnswer !== undefined;
  const finished = total > 0 && userAnswers.length === total;
  const percent = total ? Math.round((userAnswers.length / total) * 100) : 0;

  // Подія з дочірнього компонента: перевіряє відповідь і оновлює бали.
  // chosenIndex === -1 означає, що час на відповідь вичерпано.
  function handleAnswer(chosenIndex) {
    if (answered) return;
    const isCorrect = chosenIndex === current.correctIndex;
    setUserAnswers(prev => [...prev, { questionIndex: currentIndex, chosenIndex, isCorrect }]);
    if (isCorrect) setScore(prev => prev + 1);

    // Остання відповідь: квіз завершено, зберігаємо результат.
    if (userAnswers.length + 1 === total) {
      saveResult(isCorrect ? score + 1 : score);
    }
  }

  function handleNext() {
    if (currentIndex < total - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
      setUserAnswers([]);
      setScore(0);
    }
  }

  return (
    <>
      <section id="questions">
        {loading && <p className="status">Завантаження питань…</p>}
        {error && <p className="status status-error" role="alert">{error}</p>}

        {current && (
          <>
            <h2 className="huge-question-number">
              {String(currentIndex + 1).padStart(2, '0')}
            </h2>
            <TimerCanvas
              key={`${current.id}-${current.question}`}
              duration={current.timeLimit}
              running={!answered && !loading}
              onTimeout={() => handleAnswer(-1)}
            />
            <QuizQuestion
              key={current.id}
              question={current.question}
              options={current.options}
              correctIndex={current.correctIndex}
              selectedIndex={selectedIndex}
              onAnswer={handleAnswer}
            />
            {answered && selectedIndex === -1 && (
              <p className="status status-error">Час вийшов!</p>
            )}
            {finished && (
              <p className="status">Квіз завершено: {score} з {total}</p>
            )}
            {answered && (
              <button type="button" className="action-btn" onClick={handleNext}>
                {currentIndex < total - 1 ? 'Наступне питання' : 'Почати спочатку'}
              </button>
            )}
          </>
        )}

        <button type="button" className="action-btn" onClick={loadData} disabled={loading}>
          Оновити
        </button>
      </section>

      <div className="progress-container">
        <div className="progress-info">
          <span className="progress-text">
            Питання {total ? currentIndex + 1 : 0} з {total}
          </span>
          <span className="progress-text">Бали: {score}</span>
          <span className="progress-percent">{percent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%` }}></div>
        </div>
      </div>

      <ResultsList results={results} error={dbError} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('quiz-root')).render(<App />);