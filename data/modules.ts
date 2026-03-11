
import { ProjectModule } from '../types';

export const QMONEY_MODULE: ProjectModule = {
    id: 'qmoney',
    title: 'QMoney',
    description: 'Build a stock portfolio analyzer using Java and REST APIs.',
    duration: '60 hours',
    focus: 'Core Java, JSON, REST API',
    prerequisites: 'Basic Java programming, Elementary OOPs concepts.',
    techStack: ['Java', 'Spring', 'Jackson', 'Gradle'],
    level: 'Intermediate',
    steps: [
        {
            id: 'intro',
            title: 'Introduction',
            isCompleted: true,
            isLocked: false,
            type: 'overview',
            description: 'Understand the domain of FinTech and the project goals.',
            objectives: [
                'Understand what a Portfolio Management System is.',
                'Learn about the QMoney architecture.',
                'Get familiar with the development environment.'
            ],
            studyContent: [
                {
                    id: 's1',
                    title: 'Welcome to QMoney',
                    type: 'article',
                    duration: '5 min read',
                    content: `
            <h3>About QMoney</h3>
            <p>QMoney is a visual stock portfolio analyzer. It helps portfolio managers make trade recommendations for their clients.</p>
            <p><strong>Goal:</strong> You will build the backend logic to calculate annualized returns for a given portfolio of stocks.</p>
            <p>The system takes a user's portfolio (JSON file with stock symbols and purchase dates) and an end date as input.</p>
          `
                },
                {
                    id: 's2',
                    title: 'Project Architecture',
                    type: 'documentation',
                    duration: '10 min',
                    content: `
            <p>The solution is a Java Application that interacts with:</p>
            <ul>
              <li><strong>Local File System:</strong> To read user portfolios.</li>
              <li><strong>Tiingo API:</strong> A 3rd-party stock market data provider.</li>
            </ul>
            <p>All business logic is encapsulated in the <code>PortfolioManager</code> interface.</p>
          `
                }
            ]
        },
        {
            id: 'step1',
            title: 'Read user portfolio file',
            isCompleted: false,
            isLocked: false,
            type: 'task',
            description: 'Parse a JSON file containing stock trades.',
            objectives: [
                'Learn to read files in Java.',
                'Understand JSON structure.',
                'Use the Jackson library to deserialize JSON to Java Objects.'
            ],
            studyContent: [
                {
                    id: 'study-json-1',
                    title: 'Introduction to JSON',
                    type: 'article',
                    duration: '10 min read',
                    url: 'https://www.json.org/json-en.html',
                    content: `
            <p><strong>JSON (JavaScript Object Notation)</strong> is a lightweight data-interchange format. It is easy for humans to read and write.</p>
            <pre><code>
{
  "trades": [
    {"symbol": "AAPL", "quantity": 100, "purchaseDate": "2023-01-01"},
    {"symbol": "GOOGL", "quantity": 50, "purchaseDate": "2023-05-15"}
  ]
}
            </code></pre>
          `
                },
                {
                    id: 'study-jackson-1',
                    title: 'Using Jackson Object Mapper',
                    type: 'code-snippet',
                    duration: '15 min read',
                    content: `
            <p>Jackson is a popular JSON library for Java. Here's how to map a JSON string to a Java POJO:</p>
            <pre><code>
ObjectMapper mapper = new ObjectMapper();
PortfolioTrade[] trades = mapper.readValue(new File("trades.json"), PortfolioTrade[].class);
            </code></pre>
            <p>Ensure your <code>PortfolioTrade</code> class has getters, setters, and a no-arg constructor.</p>
          `
                }
            ],
            task: {
                id: 'task-1',
                title: 'Implement calculateAnnualizedReturn',
                description: 'Update the `PortfolioManagerApplication.java` file. Complete the `readTradesFromJson` method to parse the given filename and return a list of Trade objects.',
                acceptanceCriteria: [
                    'The method should correctly read the file from the given path.',
                    'It should return a list of PortfolioTrade objects.',
                    'Handle standard IOExceptions gracefully.'
                ],
                hints: [
                    'Use `ObjectMapper` from `com.fasterxml.jackson.databind`.',
                    'Create a `PortfolioTrade` POJO class if it doesn\'t exist.'
                ]
            }
        },
        {
            id: 'step2',
            title: 'Get stock quotes from API',
            isCompleted: false,
            isLocked: true,
            type: 'task',
            description: 'Fetch real-time stock data from Tiingo API.',
            objectives: [
                'Understand REST APIs.',
                'Learn to use RestTemplate in Spring.',
                'Parse complex API responses.'
            ],
            studyContent: [
                {
                    id: 'study-rest-1',
                    title: 'What is a REST API?',
                    type: 'article',
                    duration: '10 min read',
                    content: '<p>REST (Representational State Transfer) is an architectural style for providing standards between computer systems on the web.</p>'
                },
                {
                    id: 'study-tiingo-1',
                    title: 'Tiingo API Documentation',
                    type: 'documentation',
                    url: 'https://api.tiingo.com/documentation/end-of-day',
                    content: '<p>Refer to the endpoint: <code>/daily/{ticker}/prices</code> to get End-of-Day stock prices.</p>'
                }
            ],
            task: {
                id: 'task-2',
                title: 'Fetch Stock Prices',
                description: 'Implement the `fetchStockQuotes` method. Use `RestTemplate` to call the Tiingo API for each symbol in the portfolio.',
                acceptanceCriteria: [
                    'Successfully make an HTTP GET request.',
                    'Extract the "close" price from the response.',
                    'Handle API errors (404, 500).'
                ],
                hints: [
                    'Use `RestTemplateBuilder` to create a `RestTemplate` instance.',
                    'The API returns a list of candles; you usually need the last one for the given date range.'
                ]
            }
        },
        {
            id: 'step3',
            title: 'Calculate Annualized Returns',
            isCompleted: false,
            isLocked: true,
            type: 'task',
            description: 'Implement the financial logic to compute returns.',
            objectives: [
                'Understand Annualized Return formula.',
                'Apply business logic to processed data.'
            ],
            task: {
                id: 'task-3',
                title: 'Compute Returns',
                description: 'Calculate the total return and then annualize it based on the holding period.',
                acceptanceCriteria: [
                    'Correctly implement the formula: (Present Value / Buy Value) ^ (1/n) - 1',
                    'Sort the results by annualized return in descending order.'
                ],
                hints: []
            }
        }
    ]
};

export const SAMPLE_MODULES: ProjectModule[] = [
    QMONEY_MODULE,
    {
        id: 'qkart',
        title: 'QKart',
        description: 'A full-stack e-commerce application with React and Node.js.',
        duration: '45 hours',
        focus: 'React, Node.js, MongoDB',
        prerequisites: 'Basic JS, HTML/CSS',
        techStack: ['React', 'Node.js', 'Express', 'MongoDB'],
        level: 'Advanced',
        steps: [
            {
                id: 'qkart-1',
                title: 'Project Setup & UI',
                isCompleted: false,
                isLocked: false,
                type: 'setup',
                description: 'Initialize the MERN stack project.',
                studyContent: [],
                task: {
                    id: 'task-qkart-1',
                    title: 'Setup React & Express',
                    description: 'Create the folder structure and install dependencies.',
                    acceptanceCriteria: ['React app runs on port 3000', 'Express server runs on port 8082'],
                    hints: []
                }
            }
        ]
    }
];
