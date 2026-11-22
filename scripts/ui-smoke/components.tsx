import React from 'react'
import {previewImage} from './taro'
const aria=({ariaLabel,ariaRole,...props}:any)=>({...props,...(ariaLabel?{'aria-label':ariaLabel}:{}),...(ariaRole?{role:ariaRole}:{})})
export const View=({children,...props}:any)=><div {...aria(props)}>{children}</div>
export const Text=({children,...props}:any)=><span {...props}>{children}</span>
export const Button=({children,...props}:any)=><button {...props}>{children}</button>
export const Canvas=({type,...props}:any)=><canvas {...props}/>
export const Image=({mode,src,ariaLabel,...props}:any)=><img alt={ariaLabel||''} src={previewImage(src)} {...props}/>
export const Slider=({onChange,...props}:any)=><input type='range' {...props} onChange={e=>onChange({detail:{value:Number(e.target.value)}})}/>
export const Textarea=({maxlength,onInput,...props}:any)=><textarea maxLength={maxlength} {...aria(props)} onChange={e=>onInput({detail:{value:e.target.value}})}/>
