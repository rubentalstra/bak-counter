## Bak-counter
An website for keeping track of the 'BAK' a person has

## Tabel Of Contents
- [Bak-counter](#bak-counter)
- [Tabel Of Contents](#tabel-of-contents)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installing](#installing)
- [Built With](#built-with)
- [Authors](#authors)
- [License](#license)

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

What things you need to install the software and how to install them:

- Node.js
- npm (Node Package Manager)
- SQLite (for local development)

### Installing

A step-by-step series of examples that tell you how to get a development environment running.

1. **Clone the repository**

    ```
    git clone [repository URL]
    cd [local repository]
    ```

2. **Create a `.env` file in the root directory**

    Copy the following content into the `.env` file. Make sure to replace `your_random_secret_here` with a strong, unique secret for the `SESSION_SECRET`. Set `LOCAL_DB` to `true` or `false` depending on if you are using a local SQLite database or the MySQL database hosted on Azure.

    ```
    GOOGLE_CLIENT_ID=
    GOOGLE_CLIENT_SECRET=
    SESSION_SECRET=your_random_secret_here
    ADMIN_EMAILS=
    LOCAL_DB=true|false
    ```

3. ***Prepare the database connection for local development***
    ##### !! Not required if `LOCAL_DB` in `.env` is set to `true` !!

    Go to `models/index.js`:

    - Uncomment the SQLite database connection for local development:

        ```javascript
        // Initialize the database connection
        const sequelize = new Sequelize('sqlite:./db.sqlite');
        ```

    - Comment out the Azure SQL Server database connection:

        ```javascript
        // Initialize the database connection for Azure SQL Server using environment variables
        // const sequelize = new Sequelize(...);
     ```

4. ***Modify the `app.js` for local development***
    ##### !! Not required if `LOCAL_DB` in `.env` is set to `true` !!

    In the root file `app.js`, comment out the following to disable secure cookies in a non-HTTPS environment:

    ```javascript
    // secure: true,
    // domain: 'bak-counter.azurewebsites.net',
    ```

5. **Install dependencies**

    Run the following command in your terminal:

    ```
    npm i
    ```

6. **Start the application**

    Once the installation is done, you can run the following command to start the application:

    ```
    npm start
    ```

7. **Access the application**

    Open your web browser and go to [http://localhost:8080](http://localhost:8080).


## Built With

- Node.js - The runtime environment used
- Express - The web framework used
- SQLite/Azure SQL - The database used

<!-- ## Contributing

Please read [CONTRIBUTING.md](link to CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us. -->


## Authors

- **Ruben Talstra** - *Initial work* - [rubentalstra](https://github.com/rubentalstra)

See also the list of [contributors]((https://github.com/rubentalstra/bak-counter/graphs/contributors)) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details


