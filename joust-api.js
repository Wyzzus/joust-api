const express = require('express');
const router = require('express-promise-router')();
const mysql = require('mysql');
const dotenv = require('dotenv');
const cors = require('cors')
dotenv.config();

const bodyParser = require("body-parser")
const jsonParser = bodyParser.json();
const sql_helper = require('./helpers/sql-helper');

const app = express();

app.use('/', cors(), router);

router.get('/ping', ping);

router.get('/joust/getall', getJoustes);
router.get('/joust/get/', getJoust);
router.post('/joust/add', jsonParser, addJoust);
router.post('/joust/remove', jsonParser, removeJoust);
router.post('/joust/attend', jsonParser, attendOnJoust);
router.get('/joust/attendees', getAttendees);
router.get('/joust/start', jsonParser, startJoust);

router.get('/competitions/get/', getCompetition);
router.get('/competitions/getall', getCompetitions);
router.post('/competitions/update', jsonParser, updateCompetition);
router.post('/competitions/win', jsonParser, setWinner);

router.post('/user/create', jsonParser, createUser);
router.post('/user/auth', jsonParser, authUser);

async function ping(req, res)
{
    console.log(req.query);

    res.status(200).json({message: 'pong'})
}
//#region Joustes
async function getJoust(req,res)
{
    let result = [];
    let comps = [];
    const connection = sql_helper.createConnection();
    if(!req.query || req.query.id === undefined)
        res.status(404).json({message: 'Not found!'});
    let inserts = [req.query.id];
    result = await sql_helper.promiseSQL(connection, 'select j.*, u.name as winner_name from joustes j left join users u on u.id = j.winner where j.id = ?', inserts);
    comps = await sql_helper.promiseSQL(connection, 
        `select c.*, m1.name as m1_name, m2.name as m2_name, w.name as winner_name 
        from competitions c 
        left join users m1 on m1.id = c.member1 
        left join users m2 on m2.id = c.member2 
        left join users w on w.id = c.winner 
        where joust_id = ?`, inserts);
    attendees = await sql_helper.promiseSQL(connection, 
        `select 
        a.user_id, 
        u.name, 
        a.score 
        from attendees a 
        left join users u on u.id = a.user_id  
        where joust_id = ?`, inserts);
    connection.end;
    result[0].copmetitions = comps;
    result[0].attendees = attendees;
    res.status(200).json({joust: result[0]});
}

async function getJoustes(req,res)
{
    let result = [];
    const connection = sql_helper.createConnection();
    result = await sql_helper.promiseSQL(connection, 'select j.*, u.name as winner_name from joustes j left join users u on u.id = j.winner', []);
    connection.end;
    res.status(200).json({joustes: result});
}

async function addJoust(req,res)
{
    const connection = sql_helper.createConnection();
    let inserts = [ req.body.type, 
                    req.body.name,
                    req.body.description,
                    req.body.created_by,
                    req.body.location,
                    req.body.date_start,
                    req.body.date_end,
                    0
                ];
    result = await sql_helper.promiseSQL(connection, 
        `insert into joustes 
        (type, name, description, created_by, 
        location, date_start, date_end, status) 
        values (?,?,?,?,?,?,?,?)`, inserts);
    connection.end;
    res.status(200).json({message: "Successfully added"});
}

async function removeJoust(req,res)
{
    const connection = sql_helper.createConnection();
    let inserts = [req.body.joust_id];
    result = await sql_helper.promiseSQL(connection, 'delete from joustes where id = ?', inserts);
    connection.end;
    res.status(200).json({message: "Successfully removed"});
}

async function attendOnJoust(req,res)
{
    let result = [];
    let inserts = [  
        req.body.user_id,
        req.body.joust_id
    ];
    const connection = sql_helper.createConnection();
    result = await sql_helper.promiseSQL(connection, 'insert into attendees (user_id, joust_id) values (?, ?)', inserts);
    connection.end;
    res.status(200).json({message: "Successfully registered on joust!"});
}

async function getAttendees(req,res)
{
    let result = [];
    if(!req.query || req.query.id === undefined)
        res.status(404).json({message: 'Not found!'});
    let inserts = [req.query.id];
    const connection = sql_helper.createConnection();
    result = await sql_helper.promiseSQL(connection, 'select * from attendees where joust_id = ?', inserts);
    connection.end;
    res.status(200).json({attendees: result});
}

async function startJoust(req,res)
{
    let res_message = "";
    const connection = sql_helper.createConnection();
    let inserts = [req.query.id];
    let joust_service_info = await sql_helper.promiseSQL(connection, 'select type, status from joustes where id = ?', inserts);
    let attendees = await sql_helper.promiseSQL(connection, 'select user_id from attendees where joust_id = ?', inserts);
    if(joust_service_info[0].status == 0)
    {
        let type = "";
        let success = false;
        switch(joust_service_info[0].type)
        {
            case 0:
                console.log("Create circle");
                type = "circle";
                success = await createCircle(connection, attendees, req.query.id);
                break;
            case 1:
                console.log("Create olympic");
                type = "olympic";
                success = await createOlympic(connection, attendees, req.query.id);
                break;
        }
        if(success)
        {
            //await sql_helper.promiseSQL(connection, 'update joustes set status = 1 where id = ?', inserts);
            res_message = "Successfully created " + type + " system!";
        }
        else
        {
            res_message = "Error with start!";
        }
    }
    else
    {
        res_message = "Joust is started already!"
    }
    connection.end;
    res.status(200).json({message: res_message});
}
//#endregion

//#region Competitions

async function getCompetition(req,res)
{
    let result = [];
    let comps = [];
    const connection = sql_helper.createConnection();
    if(!req.query || req.query.id === undefined)
        res.status(404).json({message: 'Not found!'});
    let inserts = [req.query.id];
    result = await sql_helper.promiseSQL(connection, 'select * from competitions where id = ?', inserts);
    connection.end;
    res.status(200).json({copmetition: result[0]});
}

async function getCompetitions(req,res)
{
    let result = [];
    const connection = sql_helper.createConnection();
    if(!req.query || req.query.id === undefined)
        res.status(404).json({message: 'Not found!'});
    let inserts = [req.query.id];
    result = await sql_helper.promiseSQL(connection, 'select * from competitions where joust_id = ?', inserts);
    connection.end;
    res.status(200).json({copmetitions: result});
}

async function updateCompetition(req,res)
{
    let result = [];
    let comps = [];
    const connection = sql_helper.createConnection();
    let inserts = [
        req.body.description,
        req.body.date_start,
        req.body.date_end,
        req.body.status,
        req.body.id
    ];
    result = await sql_helper.promiseSQL(connection, 'update competitions set description = ?, date_start = ?, date_end = ?, status = ? where id = ?', inserts);
    connection.end;
    res.status(200).json({message: "Successfully updated!"});
}

async function setWinner(req,res)
{
    let result = [];
    let comps = [];
    const connection = sql_helper.createConnection();
    let inserts = [
        req.body.winner_id,
        2,
        req.body.competition_id,
        req.body.joust_id
    ];
    result = await sql_helper.promiseSQL(connection, 'update competitions set winner = ?, status = ? where id = ?', inserts);
    inserts = [
        req.body.winner_id,
        req.body.joust_id
    ];
    await sql_helper.promiseSQL(connection, 'update attendees set score = score + 1 where user_id = ? and joust_id = ?', inserts);
    
    inserts = [
        req.body.joust_id
    ];
    let joust_service_info = await sql_helper.promiseSQL(connection, 'select type, status from joustes where id = ?', inserts);
    let type = joust_service_info[0].type;

    switch(type)
    {
        case 1:
            
            result = await sql_helper.promiseSQL(connection, 'select id, member1, member2 from competitions where member1 is null or member2 is null and joust_id = ?', inserts);
            
            let mes = 42;
            if(result.length > 0)
            {
                inserts = [
                    req.body.winner_id,
                    result[0].id
                ];
                if(result[0].member1 === null)
                {
                    await sql_helper.promiseSQL(connection, 'update competitions set member1 = ? where id = ?', inserts);
                }
                else
                {
                    if(result[0].member2 === null)
                    {
                        await sql_helper.promiseSQL(connection, 'update competitions set member2 = ? where id = ?', inserts);
                    }
                }
            }
            break;
    }

    connection.end;
    res.status(200).json({message: "Successfully updated! Set winner " + req.body.winner_id + " for competition " + req.body.competition_id});
}

//#endregion

//#region Users

async function createUser(req, res)
{
    const connection = sql_helper.createConnection();

    let inserts = [
        req.body.name,
        req.body.login,
        req.body.password,
        req.body.type || 2
    ]

    let result = await sql_helper.promiseSQL(connection,
        `insert into users (name, login, password, type)
        values (?,?,?,?)`,
        inserts);
    
    connection.end;
    let endMessage = 'Пользователь ' + req.body.name + " зарегистрирован!";
    let user = {};
    user.id = result.insertId;
    res.status(200).json({message: endMessage, user: user});
}

async function authUser(req, res)
{
    const connection = sql_helper.createConnection();

    let inserts = [
        req.body.login
    ]

    let result = await sql_helper.promiseSQL(connection,
        `select id, name, password from users where login = ?`,
        inserts);
    
    let endMessage = "Неизвестная ошибка!";
    let code = 200;
    let user = {};
    if(result.length > 0)
    {
        if(result[0].password === req.body.password)
        {
            endMessage = "Добро пожаловать, " + result[0].name + "!";
            user.id = result[0].id;
            user.name = result[0].name;
            user.type = result[0].type;
            user.role = result[0].role;
            code = 200;
        }
        else
        {
            endMessage = "Неверный логин или пароль!";
            code = 400;
        }
    }
    else
    {
        endMessage = "Пользователь не найден!";
        code = 404;
    }

    connection.end;
    res.status(code).json({message: endMessage, user: user});
}


//#endregion

//#region Non API

async function createOlympic(connection, attendees, joust_id)
{
    let power = Math.log2(attendees.length);
    let first_stage = true;
    if(power === Math.round(power) && power > 0)
    {
        while(power > 0)
        {
            for(let i = 0; i < (2 ** power) - 1; i+=2)
            {
                if(first_stage)
                {
                    let inserts = [joust_id, attendees[i].user_id, attendees[i+1].user_id, 0, power];
                    await sql_helper.promiseSQL(connection, 'insert into competitions (joust_id, member1, member2, status, stage) values (?,?,?,?,?)', inserts);
                }
                else
                {
                    let inserts = [joust_id, 0, power];
                    await sql_helper.promiseSQL(connection, 'insert into competitions (joust_id, status, stage) values (?,?,?)', inserts);
                }
            }
            first_stage = false;
            power--;
        }
        return true;        
    }
    else
    {
        return false;
    }
}

async function createCircle(connection, attendees, joust_id)
{
    let count = attendees.length;
    for (let i = 0; i < count; i++)
    {
        for (let j = i+1; j < count; j++)
        {
            let inserts = [joust_id, attendees[i].user_id, attendees[j].user_id, 0, 1];
            await sql_helper.promiseSQL(connection, 'insert into competitions (joust_id, member1, member2, status, stage) values (?,?,?,?,?)', inserts);
        }
    }
    return true;
}

//#endregion

const start = function(callback) {
    app.listen(process.env.API_PORT || 1000, function () {
        console.log(`API service is listening on port ${this.address().port}`);
        if (callback) {
            callback();
        }
    })
}

module.exports = {
    start
}