// Фреймворк: React 18 (через CDN). Обрано, бо рендер списку робиться звичайним
// map() у JSX, без окремого синтаксису шаблонів, і працює без збірки та Node.js.

const { useState, useEffect } = React;

const API_URL = 'https://opentdb.com/api.php?amount=10&type=multiple';

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

// Перетворює results[] з API на формат { id, question, options, correctIndex }.
function mapResults(results) {
  return results.map((item, index) => {
    const correct = decodeHtml(item.correct_answer);
    const options = shuffle([correct, ...item.incorrect_answers.map(decodeHtml)]);
    return {
      id: index,
      question: decodeHtml(item.question),
      options,
      correctIndex: options.indexOf(correct)
    };
  });
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

  // Читає всі результати з IndexedDB і кладе їх у стан (інтерфейс оновиться сам).
  async function refreshResults() {
    try {
      setResults(await getAllItems());
      setDbError('');
    } catch (err) {
      console.error('IndexedDB недоступна:', err);
      setDbError('Не вдалося працювати зі сховищем результатів. Можливо, IndexedDB недоступна.');
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
            <QuizQuestion
              key={current.id}
              question={current.question}
              options={current.options}
              correctIndex={current.correctIndex}
              selectedIndex={selectedIndex}
              onAnswer={handleAnswer}
            />
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