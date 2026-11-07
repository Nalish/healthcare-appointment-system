import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(){
    try {
        const departments=await prisma.department.findMany({
            orderBy:{
                name:"asc"
            }
        })
        return NextResponse.json(departments,{status:200})
    } catch (error) {
        console.error("Error fetching departments",error)

        return NextResponse.json(
            {message:"Failed to fetch departments"},
            {status:500}
        )
    }
}

export async function POST(request:Request){
    try {
        const body=await request.json()
        const name=typeof body.name ==="string" ?body.name.trim() :"";
        const description=typeof body.description ==="string" ?body.description.trim() : null;

        if(!name){
            return NextResponse.json(
                {message:"Department is required"},
                {status:400}
            )
        }
        const department=await prisma.department.create({
            data:{
                name,
                description
            }
        })
return NextResponse.json(department,{status:201})
    } catch (error) {
        if(
            error instanceof Error &&
            "code" in error &&
            error.code === "P2002"
        ){
            return NextResponse.json(
                {message:"Adeparment with this name already exists"},
                {status:409}
            )
        }
        console.error("Error creating department",error)

        return NextResponse.json(
            {message:"Failed to create department"},
            {status:500}
        )
    }
}