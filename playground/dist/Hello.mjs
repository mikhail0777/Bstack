import { Component } from 'Bstack-client';
                    
        
                    export default class Hello extends Component {
                        constructor(props) {
                            super(props);
                            
                        }
                        render() {
                            return (
                                this.Element("div", {
                        "id": "title"
                    }, [
                        this.Text("hello world")
                    ])
                            )
                        }
                    }