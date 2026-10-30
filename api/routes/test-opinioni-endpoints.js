'use strict';
const express=require('express');
const {getAllOpinions}=require('../services/opinionCatalog');
const router=express.Router();

// Legacy diagnostic route: report code-owned, PUBLIC metadata without any SQL.
router.get('/', (_req,res)=>{
  const catalog=getAllOpinions();
  return res.json({success:true,message:'Catalogo Opinioni da codice',results:{
    catalogAvailable:true,
    tableExists:true, // Deprecated response key for older diagnostic clients.
    totalOpinions:String(catalog.length),
    structure:[
      {column_name:'id',data_type:'text'},
      {column_name:'text',data_type:'text'},
      {column_name:'gradi_opinione',data_type:'ARRAY'},
      {column_name:'approfondimento',data_type:'text'}
    ],
    sampleOpinions:catalog.slice(0,3)
  }});
});
module.exports=router;
