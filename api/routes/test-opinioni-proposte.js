'use strict';
const express=require('express');
const {getPool}=require('../config/database');
const {verifyToken,requireAdmin}=require('../middleware/auth');
const router=express.Router();
const pool=getPool();

// Legacy diagnostic, intentionally NOT mounted by api/app.js. It must remain
// read-only if used in a controlled Admin test. Never CREATE or seed tables.
router.get('/',verifyToken,requireAdmin,async(_req,res)=>{
  try{
    const result=await pool.query('SELECT COUNT(*)::int AS count FROM public.opinioni_proposte');
    return res.json({success:true,tableExists:true,count:result.rows[0]?.count||0});
  }catch(error){
    if(error.code==='42P01')return res.status(503).json({success:false,error:'PROPOSALS_TABLE_REQUIRED'});
    console.error('Errore diagnostica proposte:',error.message);
    return res.status(500).json({success:false,error:'Errore diagnostica proposte'});
  }
});
module.exports=router;
