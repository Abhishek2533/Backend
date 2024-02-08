import React from 'react'
import Button from '@mui/material/Button';
import { purple } from '@mui/material/colors';

function Navbar() {
    return (
        <div className='flex'>
            <nav>
                <div className='text-white'>Logo</div>

                <div>
                    <Button variant="text" className='text-white' sx={{ color: `${purple}` }}>Login</Button>
                    <Button variant="contained" className='text-black'>SignUp</Button>
                </div>
            </nav >
        </div >
    )
}

export default Navbar