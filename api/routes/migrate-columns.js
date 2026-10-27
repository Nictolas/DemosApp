'use strict';
// Retired migration endpoint: schema modifications must use separately
// reviewed and approved SQL migrations, never an HTTP route or public Pool.
const express=require('express');
const {verifyToken,requireAdmin}=require('../middleware/auth');
const router=express.Router();
router.use(verifyToken,requireAdmin);
router.post('/columns',(_req,res)=>{
  res.set('Cache-Control','no-store');
  return res.status(410).json({
    success:false,code:'LEGACY_HTTP_SCHEMA_MIGRATION_RETIRED',
    message:'Schema migration requires an approved offline maintenance operation.'
  });
});
module.exports=router;
