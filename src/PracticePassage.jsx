import React from 'react';
export default function PracticePassage({item}){
 const table=item.dataTable;
 return <>{table&&<div style={{overflowX:'auto'}}><table><caption>{table.caption}</caption><thead><tr>{table.columns.map((c,i)=><th scope="col" key={i}>{c}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((cell,n)=><td key={n}>{cell}</td>)}</tr>)}</tbody></table></div>}</>;
}
