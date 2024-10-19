import bcrypt from 'bcrypt';
import bodyParser from 'body-parser';
import express from 'express';
import mysql from 'mysql2';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine','ejs');
app.set('views','views');
app.use(bodyParser.urlencoded({ extended:false }));
app.use(express.static(path.join(__dirname,'public')))

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: "123",
    database: "notes_app"
}).promise();

app.get('/',(req,res,next)=>{
    res.redirect('login');
})


app.get('/register',(req,res,next)=>{
    const arr = req.query;
    if(req.query.error){
        const err = arr.error.replace(/_/g," ");
        console.log(err);
        res.render('register',{error:[err]});
    }
    else{
        res.render('register',{error:[]})
    }
    
})
//Deed: Registration
// Error Handled: Username exists
app.post('/registered',(req,res,next)=>{
    const name = req.body.name;
    const username = req.body.username;
    const password = req.body.password;
    const result = pool.query('select * from users where username=?',[username])
    .then((result)=>{
        if(result[0].length>0){
            res.redirect('/register?error=Username_Already_Exists')
        }
        else{
            bcrypt.hash(password,10,(err,hashedPass)=>{
                if(err){
                    console.log(err);
                }else{
                    const result = pool.query('INSERT INTO users (username,name,password,login_status) VALUES (?,?,?,false)',[username,name,hashedPass])
                    res.redirect('/login?msg=User_Succefully_Created._Please_login');
                }
            });
        }
    })
    .catch(err=>console.log(err));
})
//Deed: Login, if login Status is true then showing the dashboard of that user
app.get('/login',(req,res,next)=>{
    const arr = req.query
    const msg = [];
    const result = pool.query("SELECT user_id,username,login_status FROM users")
    .then((result)=>{
        for(let i=0; i<result[0].length;i++){
            if(result[0][i].login_status==1){
                return res.redirect(`/dashboard?username=${result[0][i].username}`)
            }
        }
        if(req.query.msg){
            const mes = req.query.msg.replace(/_/g," ")
            msg.push(mes);
        }
        return res.render('login',{msg});
    })
})
//Deed: If user entered right password, letting the user show his tasks filtering from database
//Error Handling: No one can access if the login status is False, If login status is on then login route will display the dashboard
app.post('/dashboard',(req,res,next)=>{
    const username = req.body.username;
    const password = req.body.password;
    const msg = [];
    let str1 = '';
    const result = pool.query('SELECT * FROM users where username=?',[username])
    .then((result1)=>{
        if(result1[0].length==0){
            return res.redirect('/login?msg=Username_Incorrect.')
        }else{
            console.log(result1[0][0].password);
            console.log(password);
            return bcrypt.compare(password,result1[0][0].password).then((isMatch)=>{
                if(isMatch){
                    return pool.query("UPDATE users SET login_status=true where username=?",[username])
                        .then((result2)=>{
                            return res.redirect(`/dashboard?username=${username}`);
                        }).catch(err=>console.log(err));
                }else{
                        return res.redirect('/login?msg=Password_Incorrect.')
                    }
                }).catch(err=>console.log(err));
        }
        
    }).catch(err=>console.log(err));
    console.log(username,password);
    // res.redirect('/login');
})
//deed: user's task will be shown priotizing the date value which is nearer or already due, if task is done then the status will also be updated
app.get("/dashboard",(req,res,next)=>{
    const username = req.query.username;
    const result1 = pool.query("SELECT user_id FROM users WHERE username=? and login_status=true",[username])
    .then(result1=>{
        if(result1[0].length==0){
            return res.redirect('/login?msg=Login_first')
        }
        const user_id = result1[0][0].user_id;
        if(result1[0].length>0){
            return pool.query('SELECT * FROM tasks where user_id=? ORDER BY duedate ASC',[user_id])
                    .then(([rows])=>{return rows})
                    .then((rows)=>{
                        for(let i=0; i<rows.length; i++){
                            let e_obj = new Date(rows[i].duedate);
                            const today = new Date();
                            if(e_obj.getTime() < today.getTime() & rows[i].status!='Due'){
                                const res1 = pool.query("UPDATE tasks SET status=? WHERE tid=? AND user_id=?",[rows[i].status,rows[i].tid,user_id]).then(res=>console.log('Update Successful!')).catch(err=>console.log(err))
                            }
                            let temp1 = rows[i].startdate.toString().split(" ");
                            let temparr1 = []
                            let temp = rows[i].duedate.toString().split(" ");
                            let temparr = [];
                            for(let j = 0; j<4; j++){
                                temparr1.push(temp1[j])
                                temparr.push(temp[j]);
                            }
                            rows[i].s_date = temparr1.join(" ");
                            rows[i].initial = temparr.join(" ");
                        }
                        res.render('index',{rows,username:req.query.username});
                    })
                    .catch(err=>console.log(err));
        }else{
            return res.redirect('/login?msg=Login_first')
        }
    })
})

app.post('/showdata',(req,res,next)=>{
    const taskName = req.body.name;
    const sDate = req.body.sdate;
    const eDate = req.body.edate;
    let status = "Pending";
    const s_obj = new Date(sDate);
    const e_obj = new Date(eDate);
    const today = new Date();
    if(e_obj.getTime() < today.getTime()){
        status = "Due";
    }
    const username = req.query.username;
    const result1 = pool.query("SELECT user_id FROM users WHERE username=? and login_status=true",[username])
    .then(result1=>{
        const user_id = result1[0][0].user_id;
        return pool.query('INSERT INTO tasks (user_id,tname,startdate,duedate,status,isChecked) VALUES (?,?,?,?,?,false)',[user_id,taskName,sDate,eDate,status]).then((result)=>{
                    console.log("value inserted");
                    res.redirect(`dashboard?username=${req.query.username}`)
    })
    .catch(err=>console.log(err));
    })
});

app.post('/delete',(req,res,next)=>{
    const tId = req.body.tid;
    const user_id = req.query.user_id;
    const result5 = pool.query("SELECT username FROM users where user_id=?",[user_id])
    .then((res1)=>{
        const username = res1[0][0].username;
        return pool.query("DELETE FROM tasks where tid=?",[tId])
        .then((res2)=>{res.redirect(`/dashboard?username=${username}`)}).catch(err=>{console.log(err)})
    }).catch(err=>{console.log(err)});
})

app.post('/logout',(req,res,next)=>{
    const username = req.query.username;
    const result3 = pool.query("SELECT user_id FROM users WHERE username=? and login_status=true",[username])
    .then(result4=>{
        return pool.query("UPDATE users SET login_status=false where username=?",[username])
                    .then((result2)=>{
                        return res.redirect(`/login`);
                    }).catch(err=>console.log(err))
    }).catch(err=>console.log(err))
})
//deed: use fetch api, updateing the status
app.get('/isChecked/:tid',(req,res,next)=>{
    const tid = Number(req.url.split("/")[2]);
    const result = pool.query("SELECT * from tasks WHERE tid=?",[tid])
    .then((result)=>{
        console.log(result[0][0].isChecked);
        const taskName = result[0][0].tname;
        const sDate = result[0][0].startdate;
        const eDate = result[0][0].duedate;
        let status = "Pending";
        const s_obj = new Date(sDate);
        const e_obj = new Date(eDate);
        const today = new Date();
        if(e_obj.getTime() < today.getTime()){
            status = "Due";
        }
        if(result[0][0].isChecked){
            
            return pool.query("UPDATE tasks SET isChecked=false,status=? WHERE tid=?",[status,tid])
            .then(res1=>{res.redirect('/dashboard?username=tazwar02')});
        }else{
            console.log(status,"Update Hocche...")
            return pool.query("UPDATE tasks SET isChecked=true,status='Done' WHERE tid=?",[tid])
            .then(res1=>{res.redirect('/dashboard?username=tazwar02');});
        }
        
    })
    .catch(err=>{console.log(err)})
})

app.listen(3000,()=>{
    console.log('Listening to port 3000...');
})



// http://localhost:3000/login?msg=User_Succefully_Created